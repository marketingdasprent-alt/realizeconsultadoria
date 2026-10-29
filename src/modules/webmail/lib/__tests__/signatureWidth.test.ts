import { describe, expect, it } from 'vitest';
import { applySignatureWidth, defaultSignatureWidth } from '../signatureEditing';
import { sanitizeSignatureHtml } from '../signature';

describe('largura das imagens da assinatura', () => {
  it('imagens grandes aparecem a metade (nítidas), até à largura do email', () => {
    expect(defaultSignatureWidth(2400)).toBe(600);
    expect(defaultSignatureWidth(1000)).toBe(500);
    expect(defaultSignatureWidth(300)).toBe(300);
  });

  it('a largura vai no atributo (Outlook) e no estilo com max-width (telemóveis)', () => {
    const image = document.createElement('img');
    image.setAttribute('height', '900');
    applySignatureWidth(image, 450);
    expect(image.getAttribute('width')).toBe('450');
    expect(image.getAttribute('height')).toBeNull();
    expect(image.getAttribute('style')).toBe('width:450px;max-width:100%;height:auto');
    applySignatureWidth(image, null);
    expect(image.getAttribute('width')).toBeNull();
    expect(image.getAttribute('style')).toBe('max-width:100%;height:auto');
  });
});

describe('assinatura guardada', () => {
  it('o tamanho da imagem sobrevive à limpeza do HTML', () => {
    const html =
      '<img src="https://x.pt/a.png" width="450" style="width:450px;max-width:100%;height:auto">';
    const clean = sanitizeSignatureHtml(html);
    expect(clean).toContain('width="450"');
    expect(clean).toContain('max-width:100%');
  });
});
