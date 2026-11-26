// @vitest-environment node
// Formatação dos comunicados (Pessoas → Comunicados): o parser comum e o HTML do email.
import { describe, expect, it } from 'vitest';
import { parseBlocks, parseInline } from '../../../supabase/functions/_shared/broadcast-format';
import { messageToHtml } from '../../../supabase/functions/_shared/broadcast-email';

const marks = (line: string) =>
  parseInline(line)
    .map(p => `${p.bold ? 'B' : ''}${p.italic ? 'I' : ''}[${p.text}]`)
    .join('');

describe('parseInline', () => {
  it('negrito, itálico e os dois juntos', () => {
    expect(marks('Na **segunda-feira** muda _tudo_.')).toBe(
      '[Na ]B[segunda-feira][ muda ]I[tudo][.]'
    );
    expect(marks('**_atenção_**')).toBe('BI[atenção]');
  });

  it('underscores em nomes, emails e URLs ficam intactos', () => {
    for (const s of [
      'nomes_com_traço e outro_nome',
      'escreva para joao_silva@useauto.pt hoje',
      'veja https://realize.dasprent.pt/docs/guia_rapido_v2.pdf',
      'pasta /partilhas/_privado_/x',
    ])
      expect(marks(s)).toBe(`[${s}]`);
  });

  it('marcas soltas ou com espaços por dentro não formatam', () => {
    expect(marks('2 * 3 = 6 e ** nada **')).toBe('[2 * 3 = 6 e ** nada **]');
    expect(marks('_ solto _')).toBe('[_ solto _]');
  });
});

describe('parseBlocks', () => {
  it('parágrafos por linha em branco; listas mesmo coladas a um parágrafo', () => {
    const blocks = parseBlocks('Olá,\nsegue a lista:\n- um\n- **dois**\nfim\n\n1. a\n2) b');
    expect(blocks.map(b => b.kind)).toEqual(['paragraph', 'bullets', 'paragraph', 'numbers']);
    expect(blocks[0]).toMatchObject({ kind: 'paragraph' });
    expect((blocks[1] as { items: unknown[] }).items).toHaveLength(2);
  });

  it('CRLF e espaços nas pontas', () => {
    expect(parseBlocks('\r\n  Olá\r\n\r\nAdeus  \r\n').map(b => b.kind)).toEqual([
      'paragraph',
      'paragraph',
    ]);
  });
});

describe('messageToHtml (email)', () => {
  it('<script>, aspas e & escapados também dentro de negrito e itálico', () => {
    const html = messageToHtml('**<script>alert("x")</script> & co** e _"aspas" & <b>_');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain(
      '<strong>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co</strong>'
    );
    expect(html).toMatch(/<em>&quot;aspas&quot; &amp; &lt;b&gt;<\/em>/);
  });

  it('listas com pontos e numeradas, ligações mantidas (também a negrito)', () => {
    const html = messageToHtml(
      'Passos:\n1. Abra **https://realize.dasprent.pt**\n2. Entre\n\n- a\n- b'
    );
    expect(html).toMatch(
      /<ol [^>]*><li [^>]*>Abra <strong><a [^>]*href="https:\/\/realize\.dasprent\.pt"/
    );
    expect(html).toMatch(/<ul [^>]*><li [^>]*>a<\/li><li [^>]*>b<\/li><\/ul>/);
    expect(html).toMatch(/<p [^>]*>Passos:<\/p>/);
  });

  it('caso real da captura (Mudança de domínio dos emails da oficina), com negrito', () => {
    const message = [
      'Bom dia,',
      '',
      'Deixo um aviso importante para todos os que utilizam os emails da oficina com o domínio @daspautorepair.pt.',
      '',
      'Na **segunda-feira**, todos os emails serão alterados para o novo domínio _@useauto.pt_.',
      '',
      'Por esse motivo, peço que me enviem uma mensagem privada aqui no Realize, para que eu possa atribuir as novas caixas de correio à vossa aplicação Realize.',
    ].join('\n');
    const html = messageToHtml(message);
    expect(html.match(/<p /g)).toHaveLength(4);
    expect(html).toContain('<strong>segunda-feira</strong>');
    expect(html).toContain('<em>@useauto.pt</em>');
    expect(html).toContain('@daspautorepair.pt.');
    expect(html).not.toMatch(/\*\*|_@/);
  });

  it('texto sem marcas fica como antes (parágrafos e <br>)', () => {
    expect(messageToHtml('a\nb\n\nc')).toBe(
      '<p style="margin:0 0 14px 0;line-height:1.6;">a<br>b</p><p style="margin:0 0 14px 0;line-height:1.6;">c</p>'
    );
  });
});
