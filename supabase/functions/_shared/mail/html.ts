// HTML de emails → texto (pré-visualizações), entidades e imagens inline (cid: → data:).

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  euro: '€',
  ordm: 'º',
  ordf: 'ª',
  aacute: 'á',
  agrave: 'à',
  acirc: 'â',
  atilde: 'ã',
  ccedil: 'ç',
  eacute: 'é',
  ecirc: 'ê',
  iacute: 'í',
  oacute: 'ó',
  ocirc: 'ô',
  otilde: 'õ',
  uacute: 'ú',
  Aacute: 'Á',
  Agrave: 'À',
  Acirc: 'Â',
  Atilde: 'Ã',
  Ccedil: 'Ç',
  Eacute: 'É',
  Ecirc: 'Ê',
  Iacute: 'Í',
  Oacute: 'Ó',
  Ocirc: 'Ô',
  Otilde: 'Õ',
  Uacute: 'Ú',
};

const fromCodePoint = (code: number, fallback: string): string => {
  try {
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fallback;
  } catch {
    return fallback;
  }
};

/** &amp; &#39; &#x27; &atilde; ... → caracteres. Entidades desconhecidas ficam como estão. */
export const decodeHtmlEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const hex = entity[1] === 'x' || entity[1] === 'X';
      return fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10), match);
    }
    return NAMED_ENTITIES[entity] ?? NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });

/** Texto legível de um HTML de email (sem head/style/script, com quebras de bloco). */
export const htmlToText = (html: string): string =>
  decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(head|style|script|title)\b[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|table)\s*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Pré-visualização numa linha (≤ max caracteres). */
export const makeSnippet = (text: string, max = 200): string => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
};

/** "<abc@x>" → "abc@x" (minúsculas, para comparar Content-ID com cid:). */
export const normalizeContentId = (value: string): string =>
  value.trim().replace(/^<|>$/g, '').toLowerCase();

/** Substitui src="cid:..." pelas data: URLs indicadas (chave = Content-ID normalizado). */
export const replaceCidLinks = (html: string, dataUrls: Record<string, string>): string =>
  html.replace(/(["'(])cid:([^"')\s>]+)/gi, (match, prefix: string, cid: string) => {
    let key = cid;
    try {
      key = decodeURIComponent(cid);
    } catch {
      // cid com % solto: usa como está
    }
    const url = dataUrls[normalizeContentId(key)];
    return url ? `${prefix}${url}` : match;
  });

/** Content-IDs referidos no HTML (para só descarregar as imagens inline usadas). */
export const referencedContentIds = (html: string): Set<string> => {
  const ids = new Set<string>();
  for (const m of html.matchAll(/["'(]cid:([^"')\s>]+)/gi)) {
    try {
      ids.add(normalizeContentId(decodeURIComponent(m[1])));
    } catch {
      ids.add(normalizeContentId(m[1]));
    }
  }
  return ids;
};
