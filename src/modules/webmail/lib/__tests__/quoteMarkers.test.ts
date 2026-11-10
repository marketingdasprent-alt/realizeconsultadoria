import { describe, expect, it } from 'vitest';
import { stripHtmlQuoteMarkers, stripQuoteMarkers } from '../forward';

describe('stripQuoteMarkers', () => {
  it('tira os "> " (vários níveis) do início das linhas', () => {
    expect(stripQuoteMarkers('Olá\n> Bom dia,\n>\n> > antigo\nfim')).toBe(
      'Olá\nBom dia,\n\nantigo\nfim'
    );
  });
  it('não mexe em ">" a meio da linha', () => {
    expect(stripQuoteMarkers('a > b')).toBe('a > b');
  });
});

describe('stripHtmlQuoteMarkers', () => {
  it('tira os "&gt; " a seguir a quebras e blocos', () => {
    expect(stripHtmlQuoteMarkers('Olá<br>&gt; Bom dia,<br>&gt; &gt; x<div>&gt; y</div>')).toBe(
      'Olá<br>Bom dia,<br>x<div>y</div>'
    );
  });
  it('mantém as etiquetas HTML e o texto normal', () => {
    const html = '<p>Preço &gt; 10</p><br><b>ok</b>';
    expect(stripHtmlQuoteMarkers(html)).toBe(html);
  });
});
