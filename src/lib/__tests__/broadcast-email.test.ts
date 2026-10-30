import { describe, expect, it } from 'vitest';
import {
  broadcastEmailHtml,
  cleanSignatureHtml,
} from '../../../supabase/functions/_shared/broadcast-email';

describe('assinatura nos comunicados', () => {
  it('a assinatura entra no lugar do nome; sem ela vai o nome', () => {
    const base = { subject: 'Olá', message: 'Texto', senderName: 'RH & Co' };
    expect(broadcastEmailHtml(base)).toContain('RH &amp; Co');
    const withSig = broadcastEmailHtml({
      ...base,
      signatureHtml: '<img src="https://x.pt/a.gif">',
    });
    expect(withSig).toContain('<img src="https://x.pt/a.gif">');
    expect(withSig).not.toContain('RH &amp; Co');
  });

  it('limpa o que podia correr no email', () => {
    const dirty =
      '<p onclick="x()">Thiago</p><script>alert(1)</script><a href="javascript:alert(1)">l</a>' +
      '<img src="https://x.pt/a.png" onerror=alert(1) width="600">';
    const clean = cleanSignatureHtml(dirty);
    expect(clean).not.toMatch(/onclick|onerror|<script|javascript:/i);
    expect(clean).toContain('<img src="https://x.pt/a.png" width="600">');
    expect(clean).toContain('<p>Thiago</p>');
  });
});
