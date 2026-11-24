// Cabeçalhos dos emails citados no histórico de uma resposta ("De: … Enviada: …" do Outlook e
// "Em …, Fulano escreveu:" do Gmail/Apple Mail). Servem para mostrar, no início de cada email
// citado, os anexos que esse email trouxe.

export interface QuotedHeader {
  /** Onde se põem os anexos (antes deste elemento). */
  element: Element;
  /** Email de quem enviou o email citado (minúsculas), se vier no cabeçalho. */
  from: string | null;
  /** Nome de quem enviou (o "Em …, Fulano escreveu:" muitas vezes só traz o nome). */
  name: string | null;
  /** Data do email citado, se se perceber. */
  date: Date | null;
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

const MONTHS: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
  jan: 0,
  feb: 1,
  fev: 1,
  mar: 2,
  apr: 3,
  abr: 3,
  jun: 5,
  jul: 6,
  aug: 7,
  ago: 7,
  sep: 8,
  set: 8,
  oct: 9,
  out: 9,
  nov: 10,
  dec: 11,
  dez: 11,
};

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Hora (hh:mm, com AM/PM opcional) dentro do texto. */
const timeOf = (text: string): [number, number] => {
  const m = /(\d{1,2})[:h](\d{2})(?:\s*([ap])\.?\s?m\.?)?/i.exec(text);
  if (!m) return [12, 0];
  let hours = Number(m[1]);
  const pm = m[3]?.toLowerCase() === 'p';
  if (m[3] && pm && hours < 12) hours += 12;
  if (m[3] && !pm && hours === 12) hours = 0;
  return [hours, Number(m[2])];
};

/**
 * Datas dos cabeçalhos: "19 de novembro de 2026 15:54", "quarta-feira, 19/11/2026 15:54",
 * "Wednesday, November 19, 2026 3:54 PM", "2026-11-19 15:54". null se não se perceber.
 */
export const parseHeaderDate = (raw: string): Date | null => {
  const text = fold(raw);
  const [hours, minutes] = timeOf(text);
  let m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hours, minutes);
  m = /(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/.exec(text);
  if (m) {
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(year, Number(m[2]) - 1, Number(m[1]), hours, minutes);
  }
  // "19 de novembro de 2026" / "19 nov 2026"
  m = /(\d{1,2})\s+(?:de\s+)?([a-z]{3,9})\.?\s+(?:de\s+)?(\d{4})/.exec(text);
  if (m && MONTHS[m[2]] !== undefined)
    return new Date(Number(m[3]), MONTHS[m[2]], Number(m[1]), hours, minutes);
  // "November 19, 2026"
  m = /([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(text);
  if (m && MONTHS[m[1]] !== undefined)
    return new Date(Number(m[3]), MONTHS[m[1]], Number(m[2]), hours, minutes);
  return null;
};

/** O texto que vem depois de um dos rótulos ("Enviada:") até ao rótulo seguinte. */
const fieldOf = (text: string, labels: string[]): string | null => {
  const re = new RegExp(
    `(?:^|\\n|\\s)(?:${labels.join('|')})\\s*:\\s*([\\s\\S]*?)(?=\\s(?:De|From|Para|To|Cc|Assunto|Subject|Enviada|Enviado|Sent|Data|Date)\\s*:|$)`,
    'i'
  );
  return re.exec(text)?.[1]?.trim() || null;
};

const OUTLOOK_FROM = /(?:^|\s)(De|From)\s*:/i;
const OUTLOOK_DATE = /(?:^|\s)(Enviada|Enviado|Sent|Data|Date)\s*:/i;
const WROTE = /(escreveu|wrote)\s*:\s*$/i;
const MAX_HEADER_TEXT = 700;

const LINE_BREAKS = new Set([
  'BR',
  'DIV',
  'P',
  'TR',
  'LI',
  'TABLE',
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
]);

/**
 * Texto do bloco com as linhas separadas: com textContent, "…&lt;rui@x.pt&gt;<br>Enviado: …"
 * colava "rui@x.ptEnviado:" e o rótulo deixava de se reconhecer (Outlook na web,
 * reencaminhamentos do Realize).
 */
const blockText = (el: Element): string => {
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      out += node.nodeValue ?? '';
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = (node as Element).tagName;
    if (tag === 'BR') {
      out += '\n';
      return;
    }
    node.childNodes.forEach(walk);
    if (LINE_BREAKS.has(tag)) out += '\n';
  };
  el.childNodes.forEach(walk);
  return out
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
};

const isBlock = (el: Element) =>
  ['DIV', 'P', 'TD', 'BLOCKQUOTE', 'SPAN', 'FONT'].includes(el.tagName);

/** Cabeçalhos dos emails citados, pela ordem do documento. */
export const findQuotedHeaders = (doc: Document): QuotedHeader[] => {
  const found: QuotedHeader[] = [];
  const taken = new Set<Element>();
  const all = Array.from(doc.body?.querySelectorAll('div, p, td, blockquote, span, font') ?? []);
  for (const el of all) {
    if (!isBlock(el)) continue;
    const text = blockText(el);
    if (!text || text.length > MAX_HEADER_TEXT) continue;
    // O mais interior: se um filho também é cabeçalho, fica o filho.
    const outlook = OUTLOOK_FROM.test(text) && OUTLOOK_DATE.test(text);
    const wrote = WROTE.test(text);
    if (!outlook && !wrote) continue;
    const inner = Array.from(el.querySelectorAll('div, p, td, span, font')).some(child => {
      const t = blockText(child);
      return (OUTLOOK_FROM.test(t) && OUTLOOK_DATE.test(t)) || WROTE.test(t);
    });
    if (inner) continue;
    if ([...taken].some(other => other.contains(el) || el.contains(other))) continue;

    const mailto = el.querySelector('a[href^="mailto:"]')?.getAttribute('href') ?? '';
    let from: string | null = null;
    let name: string | null = null;
    let dateText: string | null = null;
    if (outlook) {
      const fromText = fieldOf(text, ['De', 'From']) ?? '';
      from = (EMAIL.exec(fromText) ?? EMAIL.exec(mailto))?.[0] ?? null;
      name =
        fromText
          .replace(/<[^>]*>|\[[^\]]*\]/g, '')
          .replace(EMAIL, '')
          .replace(/["']/g, '')
          .trim() || null;
      dateText = fieldOf(text, ['Enviada', 'Enviado', 'Sent', 'Data', 'Date']);
    } else {
      from = (EMAIL.exec(text) ?? EMAIL.exec(mailto))?.[0] ?? null;
      const body = text
        .replace(/\s+/g, ' ')
        .replace(/^(Em|On)\s+/i, '')
        .replace(WROTE, '')
        .trim();
      dateText = body;
      // O nome vem depois da hora: "18 de novembro de 2026, 10:50, Maria Inês escreveu:"
      const afterTime = /\d{1,2}[:h]\d{2}(?:\s*[ap]\.?m\.?)?\s*,?\s*(?:(?:às|at)\s*)?(.+)$/i.exec(
        body
      )?.[1];
      name =
        (afterTime ?? '')
          .replace(/<[^>]*>/g, '')
          .replace(EMAIL, '')
          .replace(/[",]/g, '')
          .trim() || null;
    }
    if (!from && !name) continue;
    taken.add(el);
    found.push({
      element: el,
      from: from ? from.toLowerCase() : null,
      name,
      date: dateText ? parseHeaderDate(dateText) : null,
    });
  }
  return found;
};

/**
 * Mesmo remetente pelo nome ("Maria Inês CSOutdoors" = "maria ines csoutdoors"). Um nome dentro
 * do outro também conta ("Maria Inês" e "Maria Inês CSOutdoors"), com pelo menos duas palavras.
 */
export const sameName = (a: string | null | undefined, b: string | null | undefined) => {
  if (!a || !b) return false;
  const x = fold(a).replace(/\s+/g, ' ').trim();
  const y = fold(b).replace(/\s+/g, ' ').trim();
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.split(' ').length >= 2 && (long + ' ').startsWith(short + ' ');
};
