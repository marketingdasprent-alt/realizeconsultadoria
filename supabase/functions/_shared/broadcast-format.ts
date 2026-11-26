// Formatação simples dos comunicados (Pessoas → Comunicados), escrita no próprio texto como no
// WhatsApp: **negrito**, _itálico_, linhas a começar por "- " (lista) e "1. " (lista numerada).
// O mesmo código lê o texto no email (servidor) e no Feed da app, para ficarem iguais.
// Só código puro (sem Deno nem browser): usado pelos dois lados.

export interface InlinePart {
  text: string;
  bold: boolean;
  italic: boolean;
}

export type FormatBlock =
  | { kind: 'paragraph'; lines: InlinePart[][] }
  | { kind: 'bullets' | 'numbers'; items: InlinePart[][] };

const BOLD = /\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*/g;
// "_" só conta entre espaços/pontuação: nomes_com_traço e endereços ficam intactos.
const ITALIC = /(?<![\p{L}\p{N}_/:.@])_(?!\s)([^_\n]+?)(?<!\s)_(?![\p{L}\p{N}_])/gu;

const splitBy = (parts: InlinePart[], pattern: RegExp, mark: 'bold' | 'italic'): InlinePart[] =>
  parts.flatMap(part => {
    const out: InlinePart[] = [];
    let last = 0;
    for (const match of part.text.matchAll(pattern)) {
      const start = match.index ?? 0;
      if (start > last) out.push({ ...part, text: part.text.slice(last, start) });
      out.push({ ...part, text: match[1], [mark]: true });
      last = start + match[0].length;
    }
    if (last < part.text.length) out.push({ ...part, text: part.text.slice(last) });
    return out.length ? out : [part];
  });

/** Uma linha em pedaços com negrito e itálico (sem as marcas). */
export const parseInline = (line: string): InlinePart[] =>
  splitBy(
    splitBy([{ text: line, bold: false, italic: false }], BOLD, 'bold'),
    ITALIC,
    'italic'
  ).filter(part => part.text.length > 0);

const BULLET = /^\s*[-•*]\s+/;
const NUMBER = /^\s*\d{1,3}[.)]\s+/;

/**
 * Texto em blocos: uma linha em branco separa parágrafos; linhas seguidas que começam por "- "
 * (ou "1. ") formam uma lista, mesmo coladas a um parágrafo.
 */
export const parseBlocks = (message: string): FormatBlock[] => {
  const blocks: FormatBlock[] = [];
  for (const chunk of message
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n\s*\n/)) {
    if (!chunk.trim()) continue;
    let current: FormatBlock | null = null;
    for (const line of chunk.split('\n')) {
      const kind = BULLET.test(line) ? 'bullets' : NUMBER.test(line) ? 'numbers' : 'paragraph';
      if (!current || current.kind !== kind) {
        current = kind === 'paragraph' ? { kind, lines: [] } : { kind, items: [] };
        blocks.push(current);
      }
      if (current.kind === 'paragraph') current.lines.push(parseInline(line));
      else current.items.push(parseInline(line.replace(kind === 'bullets' ? BULLET : NUMBER, '')));
    }
  }
  return blocks;
};
