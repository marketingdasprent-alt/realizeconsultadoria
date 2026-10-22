// Assinaturas de email em HTML: limpeza (o HTML vai para emails de terceiros), conversão das
// assinaturas antigas em texto e montagem do email final (texto + assinatura + citação).
import { htmlToText, textToHtml } from './mailFormat';

const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'br',
  'hr',
  'p',
  'div',
  'span',
  'small',
  'font',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'center',
  'sup',
  'sub',
]);
const ALLOWED_ATTRS = new Set([
  'href',
  'src',
  'alt',
  'title',
  'width',
  'height',
  'style',
  'target',
  'align',
  'valign',
  'border',
  'cellpadding',
  'cellspacing',
  'color',
  'size',
  'face',
  'bgcolor',
  'colspan',
  'rowspan',
]);
// Etiquetas que se apagam com todo o conteúdo (o resto das desconhecidas fica só o texto).
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'svg',
  'math',
]);

const safeUrl = (value: string, kind: 'href' | 'src'): boolean => {
  const url = value.trim().toLowerCase();
  if (kind === 'src') return url.startsWith('https://') || url.startsWith('http://');
  return /^(https?:|mailto:|tel:)/.test(url);
};

/** Tira scripts, eventos e URLs perigosos; deixa formatação, tabelas, imagens e links. */
export const sanitizeSignatureHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const clean = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (DROP_WITH_CONTENT.has(tag)) {
        child.remove();
        continue;
      }
      clean(child);
      if (!ALLOWED_TAGS.has(tag)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        const keep =
          ALLOWED_ATTRS.has(name) &&
          !(name === 'href' && !safeUrl(attr.value, 'href')) &&
          !(name === 'src' && !safeUrl(attr.value, 'src')) &&
          !(name === 'style' && /expression|url\s*\(|javascript:/i.test(attr.value));
        if (!keep) child.removeAttribute(attr.name);
      }
      if (tag === 'a' && child.getAttribute('href')) {
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer');
      }
      if (tag === 'img' && !child.getAttribute('src')) child.remove();
    }
  };
  clean(doc.body);
  return doc.body.innerHTML.trim();
};

/** As assinaturas antigas eram texto simples: passam a HTML com as mesmas quebras de linha. */
export const isHtmlSignature = (signature: string) => /<[a-z][\s\S]*>/i.test(signature);

export const signatureToHtml = (signature: string | null): string => {
  const value = signature?.trim();
  if (!value) return '';
  return isHtmlSignature(value) ? sanitizeSignatureHtml(value) : textToHtml(value);
};

// Início da citação que o Realize põe ao responder (Em …, X escreveu:) ou reencaminhar.
const QUOTE_START = /\n\n(?:Em [^\n]*escreveu:|---------- Mensagem reencaminhada ----------)\n/;

/** Só o que a pessoa escreveu (sem a citação da resposta ou do reencaminhamento). */
export const writtenPart = (text: string): string => {
  const match = QUOTE_START.exec(text);
  return match ? text.slice(0, match.index) : text;
};

/**
 * Email final: o texto escrito, depois a assinatura e, por fim, a citação (como no Gmail).
 * Devolve o HTML e a versão em texto (para quem não lê HTML). Ao reencaminhar, a citação vai
 * em HTML (quotedHtml: o email original tal como veio) em vez do texto.
 */
export const composeWithSignature = (
  text: string,
  signatureHtml: string | null,
  quotedHtml: string | null = null
) => {
  const signature = signatureHtml?.trim() ? signatureHtml : '';
  if (!signature && !quotedHtml) return { text, html: textToHtml(text) };
  const match = QUOTE_START.exec(text);
  const written = match ? text.slice(0, match.index) : text;
  const quoted = match ? text.slice(match.index) : '';
  const html =
    textToHtml(written) +
    (signature ? `<div style="margin-top:16px">${signature}</div>` : '') +
    (quoted ? (quotedHtml ?? textToHtml(quoted)) : '');
  const plain = signature ? `${written}\n\n--\n${htmlToText(signature).trim()}${quoted}` : text;
  return { text: plain, html };
};
