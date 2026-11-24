# Webmail: imagens da conversa citada como no Outlook

Pedido do Thiago (24/11/2026): ao reencaminhar ou responder numa conversa longa, o envio falhava
com «Os anexos ultrapassam 14 MB», mesmo com 1,4 MB de anexos. A causa: as imagens dentro dos
emails (assinaturas, logótipos, fotos coladas) chegam ao ecrã como `data:` URLs e, ao citar a
conversa, iam escritas dentro do HTML do pedido de envio. Cada imagem contava para os 14 MB do
pedido, com mais um terço por causa do base64.

O Outlook (e o Gmail) não copia as imagens para dentro do texto: cada imagem vai uma só vez como
parte interna do email (`Content-ID`, `Content-Disposition: inline`) e o HTML aponta para ela com
`cid:`. Aqui fazemos o mesmo, e o servidor vai buscar as imagens à caixa de origem, como já faz
com os anexos do original ao reencaminhar (`remoteAttachments.ts`). Assim não passam pelo
browser nem contam para os 14 MB do pedido.

## Servidor (Moe)

1. **Marca nas imagens ao abrir um email** (`get`, em todos os caminhos que trocam `cid:` por
   `data:`: Graph, Gmail, IMAP leve e IMAP mailparser). Cada imagem convertida passa a levar um
   parâmetro na própria data URL:

   `data:<mime>;rz-src=<token>;base64,<dados>`

   - `token` = base64url (sem `=`) de `accountId + "\n" + messageId + "\n" + attachmentId`, em
     que `attachmentId` é o que `driver.attachment(messageId, attachmentId)` aceita para descarregar
     essa parte.
   - Só caracteres `[A-Za-z0-9_-]` no token, para não partir atributos nem `url(...)` no CSS.
   - Se num caminho não houver um id para descarregar a parte, a imagem fica sem marca (como hoje).
2. **Envio** (`send`, `queue-send` e `save-draft`): campo opcional
   `inline_images: { token: string; cid: string }[]` (no máximo 100; `cid` só com
   `[A-Za-z0-9._@-]`, até 100 caracteres).
   - Para cada token: descodificar; a conta tem de ser do utilizador (a mesma verificação de
     `remote_attachments`); descarregar a parte com o driver da conta de origem (em lotes, por
     mensagem, como em `fetchRemoteAttachments`).
   - Juntar cada imagem ao email como parte inline com `Content-ID: <cid>` e
     `Content-Disposition: inline`, nos três envios: SMTP (nodemailer `cid`), Microsoft Graph
     (`isInline: true`, `contentId`) e Gmail (MIME `multipart/related`).
   - Contam para o total de `MAX_TOTAL_BYTES` (18 MB) junto com os anexos do original. Acima
     disso: `too_large` com a mensagem «As imagens da conversa e os anexos passam de 18 MB.
     Retire alguns anexos ou apague parte da conversa citada.»
   - Se uma imagem não puder ser descarregada, o email sai na mesma sem ela (aviso no log) e
     o `src="cid:..."` dessa imagem é retirado do HTML.
   - Pedidos sem `inline_images` funcionam como hoje.
3. **Fila** (`queue-send`): guarda os tokens (são pequenos) e resolve-os no envio.

## Ecrã (Krusty)

- Ao enviar e ao guardar o rascunho, as data URLs marcadas no HTML final (citação, reencaminhado)
  trocam-se por `cid:rzimg-<n>@realize` (uma só vez por token, mesmo que a imagem se repita) e os
  pares `{ token, cid }` seguem em `inline_images`. Data URLs sem marca ficam como estão.
- O compositor continua a mostrar as imagens (a troca só acontece no pedido).
- Mensagem de `too_large` no ecrã: «O email passa de 14 MB (texto, imagens e anexos).»
- Conversa: um email antigo que não abre mostra «Tentar outra vez» em vez de ficar em «A abrir…».
