// Imagens dentro do email (assinaturas, logótipos, fotos coladas) como no Outlook: cada uma vai
// uma só vez como parte interna do email (cid:) e o servidor busca-a à caixa de origem.
// Antes iam escritas no HTML do pedido (data: URLs) e uma conversa longa passava dos 14 MB.
// Ver docs/webmail-imagens-citadas.md.

/** Imagem marcada pelo servidor ao abrir o email: data:<mime>;rz-src=<token>;base64,<dados>. */
const MARKED_IMAGE =
  /data:[\w.+-]+\/[\w.+-]+;rz-src=([A-Za-z0-9_-]{1,2000});base64,[A-Za-z0-9+/=]*/g;

export interface InlineImageRef {
  /** Onde o servidor vai buscar a imagem (conta, email e parte de origem). */
  token: string;
  /** Content-ID com que a imagem segue no email. */
  cid: string;
}

/**
 * Troca as imagens marcadas por `cid:` (uma por imagem, mesmo que se repita) e devolve as
 * referências para o servidor as juntar ao envio. Imagens sem marca ficam como estão.
 */
export const detachInlineImages = (html: string): { html: string; images: InlineImageRef[] } => {
  const byToken = new Map<string, string>();
  const out = html.replace(MARKED_IMAGE, (_match, token: string) => {
    let cid = byToken.get(token);
    if (!cid) {
      cid = `rzimg-${byToken.size + 1}@realize`;
      byToken.set(token, cid);
    }
    return `cid:${cid}`;
  });
  return { html: out, images: [...byToken].map(([token, cid]) => ({ token, cid })) };
};
