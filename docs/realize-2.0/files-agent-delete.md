# Agente de ficheiros (SRVDC): eliminar ficheiros e pastas (para o lixo)

O dono mudou a regra: os **administradores** do Realize passam a poder eliminar ficheiros e
pastas dos Documentos da empresa. Para um clique errado não fazer desaparecer nada, eliminar
**não apaga**: move para uma pasta de lixo no servidor, de onde se pode recuperar.

## Endpoint

```
POST https://files.dasprent.pt/api/delete?path=<caminho relativo do ficheiro ou pasta>
Authorization: Bearer <jwt>
```

- Token: o JWT HS256 de sempre (segredo `FILES_AGENT_SECRET`), com `{ op: "delete", path, exp }`.
  O `path` do token tem de ser igual ao `?path=`. Só a edge function `company-files` gera este
  token (validade 60 s), e só para administradores — o browser nunca chama este endpoint.
- Move `D:\Shares\<path>` (ficheiro ou pasta inteira) para
  `D:\Shares\_Lixo_Realize\<AAAA-MM-DD_HHMMSS>\<path>` (mantém a árvore original, para saber de
  onde veio e poder repor). Criar as pastas intermédias do lixo se faltarem.
- **Nunca apaga de verdade.** Usar mover/renomear (mesmo disco), não copiar+apagar.
- Recusar (`403`):
  - o caminho vazio, `.` ou qualquer **raiz** (`DASPRENT`, `RAZÃO DINÂMICA LDA`, `_SAAS_TESTE`);
  - tudo dentro de `_Lixo_Realize` (o lixo não se gere pelo Realize);
  - caminhos com `..` ou fora de `D:\Shares` (a mesma validação do `/api/list`).
- Ficheiro aberto/bloqueado (ex.: alguém a editar no ONLYOFFICE ou no Windows) → `423`, sem mover
  nada. Numa pasta, se alguma coisa lá dentro estiver bloqueada, não mover a pasta (`423`).
- A pasta `_Lixo_Realize` **não deve aparecer** no `/api/list` da raiz.
- Registar cada eliminação num log do agente (data, caminho original, destino no lixo).
- Resposta `200 { "trashed": true, "trash_path": "_Lixo_Realize/<carimbo>/<path>" }`.
- Erros: `400` caminho inválido, `401` token inválido/expirado, `403` op/caminho proibido,
  `404` não existe, `423` em uso.

## Limpeza do lixo

Só no próprio servidor (nunca pelo Realize): tarefa agendada que apaga de vez as entradas de
`_Lixo_Realize` com mais de **30 dias**. Repor = mover de volta à mão.

## Testar

```bash
# token de teste (op delete, 60 s) gerado com o segredo do agente
curl -X POST "https://files.dasprent.pt/api/delete?path=_SAAS_TESTE/teste.txt" \
  -H "Authorization: Bearer $TOKEN"
# → 200 e o ficheiro aparece em D:\Shares\_Lixo_Realize\<carimbo>\_SAAS_TESTE\teste.txt
# repetir → 404; path=_SAAS_TESTE → 403
```

Quando estiver pronto, avisar: do lado do Realize falta o botão "Eliminar" (só admins, com
confirmação) na página Documentos e a ação `delete` na edge function `company-files`.
