// HTML dos comunicados (Pessoas → Comunicados). A mensagem chega em texto: escapa-se, as linhas
// em branco fazem parágrafos e os endereços (https://…) ficam ligações.

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// A mesma letra da assinatura (Open Sans); onde não houver, Arial. Vai em cada célula porque o
// Gmail ignora o estilo do <body>.
export const EMAIL_FONT = "'Open Sans',Arial,Helvetica,sans-serif";

const linkify = (html: string) =>
  html.replace(
    /(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g,
    '<a href="$1" style="color:#B7933D;text-decoration:underline;">$1</a>'
  );

/** Texto → parágrafos HTML (seguro). */
export const messageToHtml = (message: string): string =>
  message
    .trim()
    .split(/\n\s*\n/)
    .map(
      paragraph =>
        `<p style="margin:0 0 14px 0;line-height:1.6;">${linkify(escapeHtml(paragraph)).replace(/\n/g, '<br>')}</p>`
    )
    .join('');

/**
 * Assinatura de email (HTML guardado pela própria pessoa no Webmail) sem nada que corra:
 * fora scripts, estilos, iframes e formulários, atributos on*, e ligações javascript:/data:.
 */
export const cleanSignatureHtml = (html: string): string =>
  html
    .slice(0, 20000)
    .replace(/<(script|style|iframe|object|embed|form|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|link|meta|base|input|button)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["']?)\s*(javascript|vbscript|data):[^"'\s>]*\2/gi, '$1="#"');

export const broadcastEmailHtml = (opts: {
  subject: string;
  message: string;
  senderName: string;
  /** Assinatura de quem envia (já limpa); sem ela, vai só o nome. */
  signatureHtml?: string | null;
}): string => `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#f4f2ee;font-family:${EMAIL_FONT};color:#1f1d2b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#111111;padding:22px 28px;">
          <span style="color:#B7933D;font-size:20px;font-weight:bold;letter-spacing:2px;">REALIZE</span>
          <span style="color:#B7933D;font-size:11px;letter-spacing:3px;display:block;margin-top:2px;">CONSULTADORIA</span>
        </td></tr>
        <tr><td style="padding:28px 28px 8px 28px;font-size:15px;font-family:${EMAIL_FONT};">
          <h1 style="margin:0 0 18px 0;font-family:${EMAIL_FONT};font-size:20px;line-height:1.3;color:#111111;">${escapeHtml(opts.subject)}</h1>
          ${messageToHtml(opts.message)}
        </td></tr>
        <tr><td style="padding:4px 28px 26px 28px;font-size:14px;color:#555555;font-family:${EMAIL_FONT};">
          ${opts.signatureHtml || escapeHtml(opts.senderName)}
        </td></tr>
        <tr><td style="background:#faf8f4;padding:14px 28px;font-family:${EMAIL_FONT};font-size:11px;color:#8a8597;">
          Comunicado interno da Realize Consultadoria · ${new Date().getFullYear()}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
