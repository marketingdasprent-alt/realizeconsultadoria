import { describe, expect, it } from 'vitest';
import { applySignatureWidth, defaultSignatureWidth } from '../signatureEditing';
import { sanitizeSignatureHtml } from '../signature';

describe('largura das imagens da assinatura', () => {
  it('por omissão ficam à largura do email; as pequenas ficam como são', () => {
    expect(defaultSignatureWidth(2400)).toBe(600);
    expect(defaultSignatureWidth(1000)).toBe(600);
    expect(defaultSignatureWidth(300)).toBe(300);
  });

  it('a largura vai no atributo (Outlook) e no estilo com max-width (telemóveis)', () => {
    const image = document.createElement('img');
    image.setAttribute('height', '900');
    applySignatureWidth(image, 450);
    expect(image.getAttribute('width')).toBe('450');
    expect(image.getAttribute('height')).toBeNull();
    expect(image.getAttribute('style')).toBe(
      'display:block;width:450px;max-width:100%;height:auto'
    );
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

describe('GIF pesado', () => {
  it('acima de 1 MB conta como pesado; leves e outras imagens não', async () => {
    const { isHeavyGif } = await import('../signatureEditing');
    const file = (type: string, size: number) => new File([new Uint8Array(size)], 'a', { type });
    expect(isHeavyGif(file('image/gif', 3_600_000))).toBe(true);
    expect(isHeavyGif(file('image/gif', 500_000))).toBe(false);
    expect(isHeavyGif(file('image/png', 3_600_000))).toBe(false);
  });
});
