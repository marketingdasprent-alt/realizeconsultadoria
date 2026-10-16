import { describe, expect, it } from 'vitest';
import { composeWithSignature, sanitizeSignatureHtml, signatureToHtml } from '../signature';

describe('assinatura em HTML', () => {
  it('tira scripts, eventos e links perigosos', () => {
    const dirty =
      '<p onclick="x()">Olá<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><img src="data:image/png;base64,AAA"><iframe src="https://x"></iframe>';
    const clean = sanitizeSignatureHtml(dirty);
    expect(clean).not.toMatch(/script|onclick|javascript|iframe|data:/);
    expect(clean).toContain('<p>Olá</p>');
  });

  it('mantém imagens com link, tabelas e estilos simples', () => {
    const html =
      '<table cellpadding="0"><tr><td style="color:#333"><a href="https://realize.pt"><img src="https://x.supabase.co/logo.png" width="120" alt="Logo"></a></td></tr></table>';
    const clean = sanitizeSignatureHtml(html);
    expect(clean).toContain('href="https://realize.pt"');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('src="https://x.supabase.co/logo.png"');
    expect(clean).toContain('style="color:#333"');
  });

  it('assinaturas antigas em texto passam a HTML com quebras de linha', () => {
    expect(signatureToHtml('Thiago\nRealize')).toContain('Thiago<br>Realize');
    expect(signatureToHtml(null)).toBe('');
  });

  it('a assinatura fica antes da citação de uma resposta', () => {
    const text = 'Obrigado!\n\nEm 16 de outubro de 2026, 10:00, Ana escreveu:\n> Olá';
    const { html, text: plain } = composeWithSignature(text, '<b>Thiago</b>');
    expect(html.indexOf('Thiago')).toBeLessThan(html.indexOf('escreveu'));
    expect(html.indexOf('Obrigado')).toBeLessThan(html.indexOf('Thiago'));
    expect(plain).toBe(
      'Obrigado!\n\n--\nThiago\n\nEm 16 de outubro de 2026, 10:00, Ana escreveu:\n> Olá'
    );
  });

  it('sem assinatura fica só o texto', () => {
    expect(composeWithSignature('Olá', null).text).toBe('Olá');
  });
});
