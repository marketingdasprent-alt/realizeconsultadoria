export type RichTextPart =
  | { kind: 'text'; value: string }
  | { kind: 'link'; value: string; href: string }
  | { kind: 'hashtag'; value: string; tag: string };

// Ligações (http://, https:// ou www.) e #hashtags. A ligação vem primeiro para um
// "#secção" dentro de um endereço não virar hashtag.
const TOKENS = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)|(#[\p{L}\p{N}_]{2,40})/giu;
// Pontuação colada ao fim da ligação ("veja https://x.pt.") fica fora dela.
const TRAILING = /[.,;:!?'"»)\]]+$/;

/** Parte um texto em bocados: texto simples, ligações clicáveis e #hashtags. */
export const richTextParts = (text: string): RichTextPart[] => {
  const parts: RichTextPart[] = [];
  const pushText = (value: string) => {
    if (!value) return;
    const last = parts[parts.length - 1];
    if (last?.kind === 'text') last.value += value;
    else parts.push({ kind: 'text', value });
  };
  let cursor = 0;
  for (const match of text.matchAll(TOKENS)) {
    const start = match.index ?? 0;
    pushText(text.slice(cursor, start));
    if (match[1]) {
      let url = match[1];
      while (TRAILING.test(url)) {
        // Um ")" só fica se a ligação também abriu um "(" (ex.: Wikipédia).
        const count = (char: string) => url.split(char).length - 1;
        if (url.endsWith(')') && count('(') >= count(')')) break;
        url = url.slice(0, -1);
      }
      parts.push({
        kind: 'link',
        value: url,
        href: /^https?:\/\//i.test(url) ? url : `https://${url}`,
      });
      pushText(match[1].slice(url.length));
    } else {
      parts.push({ kind: 'hashtag', value: match[2], tag: match[2].slice(1).toLowerCase() });
    }
    cursor = start + match[0].length;
  }
  pushText(text.slice(cursor));
  return parts;
};
