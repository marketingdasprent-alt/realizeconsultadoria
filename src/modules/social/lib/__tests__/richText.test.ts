import { describe, expect, it } from 'vitest';
import { richTextParts } from '../richText';

const links = (text: string) =>
  richTextParts(text)
    .filter(part => part.kind === 'link')
    .map(part => (part.kind === 'link' ? part.href : ''));

describe('richTextParts', () => {
  it('encontra ligações http, https e www', () => {
    expect(links('Veja https://realize.pt/a?b=1 e www.dasprent.pt hoje')).toEqual([
      'https://realize.pt/a?b=1',
      'https://www.dasprent.pt',
    ]);
  });

  it('a pontuação no fim fica fora da ligação', () => {
    const parts = richTextParts('Inscrições em https://forms.gle/abc.');
    expect(parts).toEqual([
      { kind: 'text', value: 'Inscrições em ' },
      { kind: 'link', value: 'https://forms.gle/abc', href: 'https://forms.gle/abc' },
      { kind: 'text', value: '.' },
    ]);
    expect(links('(ver https://x.pt/a)')).toEqual(['https://x.pt/a']);
    expect(links('https://pt.wikipedia.org/wiki/Porto_(cidade)')).toEqual([
      'https://pt.wikipedia.org/wiki/Porto_(cidade)',
    ]);
  });

  it('o # de um endereço não é hashtag; os outros sim', () => {
    const parts = richTextParts('#festa em https://x.pt/#mapa 🎉');
    expect(parts.map(part => part.kind)).toEqual(['hashtag', 'text', 'link', 'text']);
    expect(parts[0]).toMatchObject({ tag: 'festa' });
    expect(parts[2]).toMatchObject({ href: 'https://x.pt/#mapa' });
  });

  it('texto sem nada especial fica igual', () => {
    expect(richTextParts('Bom dia a todos 😀')).toEqual([
      { kind: 'text', value: 'Bom dia a todos 😀' },
    ]);
  });
});
