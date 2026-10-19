# Documentos da empresa no Realize — o que falta no SRVDC

O Realize já tem a página **Documentos**: navegar nas pastas, abrir e editar no ONLYOFFICE,
**Novo documento** (Word/Excel/PowerPoint em branco) e **Carregar**. Funciona como no Bitrix24, mas
os ficheiros ficam em `D:\Shares` no SRVDC e o editor é o ONLYOFFICE do próprio servidor.

Hoje (19/10) a página mostra "O editor de documentos ainda não está configurado". Faltam os passos
abaixo, todos do lado do servidor.

## Como as peças falam

```
Browser (app.realizeconsultadoria.pt)
  │  1. pede a lista / abrir / criar / carregar
  ▼
Edge function company-files (Supabase)        ← verifica o colaborador e as pastas dele
  │  2. pedidos assinados (JWT HS256, segredo FILES_AGENT_SECRET)
  ▼
https://files.dasprent.pt  ──túnel──▶  agente de ficheiros (SRVDC, :8181) ──▶ D:\Shares
                                            ▲
https://office.dasprent.pt ──túnel──▶  ONLYOFFICE Document Server (SRVDC)
                                            │  3. descarrega e grava o ficheiro em
                                            └──── http://127.0.0.1:8181 (só local)
```

## 1. Endereços públicos (DNS + túnel)

- `files.dasprent.pt` → agente de ficheiros (`http://127.0.0.1:8181`).
- `office.dasprent.pt` → ONLYOFFICE Document Server.

Ambos têm de ser HTTPS com certificado válido. Hoje os dois nomes não existem no DNS (NXDOMAIN).
Com um túnel Cloudflare, chega um `cloudflared` no SRVDC com as duas regras de ingress e os
dois registos CNAME criados pelo próprio túnel.

## 2. Agente de ficheiros (`:8181`)

Os caminhos são relativos a `D:\Shares`, com `/`, sem barra no início, como em
`DASPRENT/Marketing/Plano.docx`. Os tokens são JWT HS256
`{ "op": "...", "path": "<caminho>", "exp": <unix> }`, assinados com `FILES_AGENT_SECRET`, e
o `path` do token tem de ser igual ao `?path=` do pedido.

| Rota | `op` | Token em | Resposta |
|---|---|---|---|
| `GET /api/list?path=` | `list` | `Authorization: Bearer` | `{ entries: [{ name, type: "dir"\|"file", size?, modified }], truncated }` |
| `GET /api/file?path=&token=` | `download` | `?token=` | o ficheiro (browser pelo túnel; ONLYOFFICE por 127.0.0.1) |
| `POST /api/mkdir?path=` | `mkdir` | `Authorization: Bearer` | `{ created: true\|false }` |
| `PUT /api/upload?path=` | `upload` | `Authorization: Bearer` **ou** `?token=` | `201 { created, size, modified }` — **novo**, ver [files-agent-upload.md](files-agent-upload.md) (inclui CORS) |
| `POST /onlyoffice/callback?path=&token=` | `callback` | `?token=` | grava o que o ONLYOFFICE manda (status 2 e 6: descarregar `url` e substituir o ficheiro); responde `{"error":0}` |

Erros: `400` caminho inválido, `401`/`403` token, `404` não existe, `409` já existe, `413`
demasiado grande.

## 3. ONLYOFFICE Document Server

- JWT ligado nos pedidos do browser, de entrada e de saída, com o mesmo segredo que vai
  para `ONLYOFFICE_JWT_SECRET`. No `local.json`:
  `services.CoAuthoring.token.enable.browser/request.inbox/request.outbox = true` e
  `services.CoAuthoring.secret.*.string = <segredo>`.
- **Importante:** o ONLYOFFICE recusa por defeito descarregar de IPs privados, e o Realize
  manda-o a `http://127.0.0.1:8181`. É preciso
  `services.CoAuthoring.request-filtering-agent.allowPrivateIPAddress = true`.
- O `api.js` tem de abrir em `https://office.dasprent.pt/web-apps/apps/api/documents/api.js`.

## 4. Segredos no Supabase

Há dois segredos, iguais aos do servidor:
- `FILES_AGENT_SECRET`: o mesmo segredo que o agente usa para validar os tokens.
- `ONLYOFFICE_JWT_SECRET`: o mesmo do ponto 3.

Para os pôr, vai a Supabase → projeto `jvvnsoasylusbmxfotci` → Edge Functions → **Secrets** →
Add new secret. Também se podem pôr pela linha de comandos:

```bash
npx supabase@latest secrets set FILES_AGENT_SECRET=... ONLYOFFICE_JWT_SECRET=... --project-ref jvvnsoasylusbmxfotci
```

Os segredos não vão por email nem por chat.

## 5. Pastas de cada pessoa

O Realize só mostra as pastas atribuídas a cada colaborador, com permissão de leitura ou edição, na
tabela `folder_assignments`. Hoje só existe a de teste (`_SAAS_TESTE`). Falta a lista
"pasta → quem tem acesso (ler/editar)". Com ela, o Realize preenche a tabela.

## 6. Testes (depois dos passos 1–4)

1. `https://office.dasprent.pt/healthcheck` → `true`.
2. `https://files.dasprent.pt/api/list?path=_SAAS_TESTE` sem token → `401` (o agente responde).
3. Teste do envio: ver [files-agent-upload.md](files-agent-upload.md).
4. No Realize, abrir Documentos → `_SAAS_TESTE`:
   - abrir um `.docx`;
   - editar e carregar em Guardar;
   - confirmar a alteração em `D:\Shares\_SAAS_TESTE`;
   - Novo documento;
   - Carregar.
