// Botões de formatação do comunicado: põem as marcas no texto (**negrito**, _itálico_, "- " e
// "1. "), que o email e o Feed mostram formatadas (supabase/functions/_shared/broadcast-format.ts).

export type FormatAction = 'bold' | 'italic' | 'bullets' | 'numbers';

const MARK: Record<'bold' | 'italic', string> = { bold: '**', italic: '_' };

export interface FormatResult {
  value: string;
  /** Seleção a repor depois de aplicar. */
  selection: [number, number];
}

/**
 * Aplica a formatação ao que está selecionado. Sem seleção, põe as marcas e o cursor no meio
 * (negrito/itálico) ou começa a lista na linha atual. Repetir no mesmo texto tira a formatação.
 */
export const applyFormat = (
  value: string,
  start: number,
  end: number,
  action: FormatAction
): FormatResult => {
  if (action === 'bold' || action === 'italic') {
    const mark = MARK[action];
    // Itálico a meio de uma palavra não seria reconhecido (o "_" só conta entre espaços, para
    // proteger nomes e endereços): alarga-se à palavra inteira.
    if (action === 'italic' && start !== end) {
      const word = /[\p{L}\p{N}]/u;
      while (start > 0 && word.test(value[start - 1]) && word.test(value[start])) start--;
      while (end < value.length && word.test(value[end]) && word.test(value[end - 1])) end++;
    }
    const selected = value.slice(start, end);
    // Já formatado com as marcas dentro da seleção ("**texto**" selecionado inteiro): tira.
    if (selected.length > mark.length * 2 && selected.startsWith(mark) && selected.endsWith(mark)) {
      const inner = selected.slice(mark.length, -mark.length);
      return {
        value: value.slice(0, start) + inner + value.slice(end),
        selection: [start, start + inner.length],
      };
    }
    // Já formatado (marcas por fora da seleção): tira.
    if (
      value.slice(start - mark.length, start) === mark &&
      value.slice(end, end + mark.length) === mark
    )
      return {
        value: value.slice(0, start - mark.length) + selected + value.slice(end + mark.length),
        selection: [start - mark.length, end - mark.length],
      };
    // Espaços nas pontas ficam fora das marcas ("**texto** " e não "**texto **").
    const lead = selected.length - selected.trimStart().length;
    const trail = selected.length - selected.trimEnd().length;
    const core = selected.trim();
    const from = start + lead;
    const to = end - trail;
    return {
      value: value.slice(0, from) + mark + core + mark + value.slice(to),
      selection: [from + mark.length, from + mark.length + core.length],
    };
  }

  // Listas: todas as linhas tocadas pela seleção.
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = value.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const pattern = action === 'bullets' ? /^- / : /^\d{1,3}[.)] /;
  const isList = lines.every(line => pattern.test(line));
  const changed = lines
    .map((line, index) =>
      isList
        ? line.replace(pattern, '')
        : `${action === 'bullets' ? '- ' : `${index + 1}. `}${line.replace(/^(- |\d{1,3}[.)] )/, '')}`
    )
    .join('\n');
  const result = value.slice(0, lineStart) + changed + value.slice(lineEnd);
  return { value: result, selection: [lineStart, lineStart + changed.length] };
};
