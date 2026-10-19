# Agente de ficheiros (SRVDC): carregar ficheiros e criar documentos

O Realize 2.0 passou a ter, nos Documentos da empresa, **Novo documento** (Word/Excel/PowerPoint
em branco que abre logo no ONLYOFFICE) e **Carregar** (botão ou arrastar ficheiros). As duas
usam um endpoint novo no agente: `PUT /api/upload`.

## Endpoint

```
PUT https://files.dasprent.pt/api/upload?path=<caminho relativo do ficheiro>[&token=<jwt>]
Authorization: Bearer <jwt>      (ou ?token=, como no /api/file)
Content-Type: <tipo do ficheiro>
<corpo = bytes do ficheiro>
```

- Token: o JWT HS256 de sempre (segredo `FILES_AGENT_SECRET`), com `{ op: "upload", path, exp }`.
  O `path` do token tem de ser igual ao `?path=` (caminho completo do ficheiro novo).
- Cria o ficheiro em `D:\Shares\<path>`; a pasta-mãe tem de existir.
- **Nunca substitui**: se já existir um ficheiro ou pasta com esse nome → `409`.
- Limite: 100 MB (`413` se passar). Recusar também executáveis/scripts
  (bat, cmd, com, cpl, dll, exe, hta, jar, js, jse, lnk, msc, msi, pif, ps1, reg, scr, vbe, vbs, wsf).
- Gravar primeiro num ficheiro temporário e renomear no fim (um envio cortado não deixa lixo).
- Resposta `201 { "created": true, "size": <bytes>, "modified": "<ISO>" }`.
- Erros: `400` caminho inválido, `401` token inválido/expirado, `403` op/caminho errados,
  `404` pasta-mãe não existe, `409` já existe, `413` grande demais.

## Quem chama

1. **Novo documento** — a edge function `company-files` envia o modelo em branco pelo túnel,
   com o token no cabeçalho `Authorization` (validade 60 s).
2. **Carregar** — o browser envia o ficheiro **direto ao agente**, com o token em `?token=`
   (validade 10 min). Por isso o `/api/upload` precisa de **CORS**:
   - `OPTIONS /api/upload` → `204` com
     `Access-Control-Allow-Origin: https://app.realizeconsultadoria.pt` (e `http://localhost:8080`
     para testes), `Access-Control-Allow-Methods: PUT, OPTIONS`,
     `Access-Control-Allow-Headers: Content-Type`, `Access-Control-Max-Age: 600`.
   - O `PUT` responde com o mesmo `Access-Control-Allow-Origin`.

## Testar

```bash
# token de teste (op upload, 60 s) gerado com o segredo do agente
curl -X PUT "https://files.dasprent.pt/api/upload?path=_SAAS_TESTE/teste.txt&token=$TOKEN" \
  -H "Content-Type: text/plain" --data-binary "ola"
# → 201; repetir → 409
```

Depois, no Realize: Documentos → `_SAAS_TESTE` → Novo documento → abre no editor e grava.
