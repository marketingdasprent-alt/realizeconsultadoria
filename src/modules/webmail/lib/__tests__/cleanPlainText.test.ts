import { describe, expect, it } from 'vitest';
import { cleanPlainText } from '../forward';

// Texto simples de um orçamento da MyPRINT (Odoo), como chegou numa resposta (17/11/2026).
const ODOO = [
  '͏ ​ ͏ ​ ͏ ​ ͏ ​',
  '',
  'team_logo [13]',
  '',
  'OR 26/0626',
  '',
  '87,01 €',
  '',
  'Expira em 13-12-2026',
  '',
  'Assinar & Pagar Orçamento',
  '[1]',
  '',
  'Bom dia Thiago,',
  'espero que se encontre bem, posso enviar a fatura quando tiver pronto.',
  '',
  'Com os melhores cumprimentos,',
  '',
  'None [2] simao_f [14]',
  'None [3] simao_my [15]',
  'None [8] whatsapp [20]',
  '',
  '',
  '',
  'Política de',
  'Privacidade [10]',
  '|',
  'Termos e Condições [11]',
  '',
  '[1] https://my.wiredgroup.pt/mail/view?access_token=abc&hash=def&model=sale.order',
  '[2] https://myprint.pt/',
  '[3] https://myprint.pt/',
  '[8] https://web.whatsapp.com/send?phone=351912888515',
  '[10] https://red.com.pt/politica-de-privacidade',
  '[11] https://red.com.pt/condicoes-gerais-de-prestacao-de-servicos',
  '[13] https://my.wiredgroup.pt/team_logo.png?team=7',
  '[14] https://red.com.pt/ass/2023/imagens/simao_f.png',
  '[15] https://red.com.pt/ass/2023/imagens/myprint/simao_my.png',
  '[20] https://red.com.pt/ass/2023/imagens/myprint/whatsapp.png',
].join('\n');

describe('cleanPlainText', () => {
  const out = cleanPlainText(ODOO);

  it('tira as notas de rodapé das ligações e os marcadores [n]', () => {
    expect(out).not.toMatch(/https?:\/\//);
    expect(out).not.toMatch(/\[\d+\]/);
  });
  it('tira "None [n]" e o nome dos ficheiros das imagens', () => {
    expect(out).not.toMatch(/None/);
    expect(out).not.toMatch(/team_logo|simao_f|simao_my|whatsapp/);
  });
  it('tira os caracteres invisíveis', () => {
    expect(out).not.toMatch(/[͏​]/);
  });
  it('mantém o texto que a pessoa lia', () => {
    expect(out).toContain('OR 26/0626');
    expect(out).toContain('87,01 €');
    expect(out).toContain('Assinar & Pagar Orçamento');
    expect(out).toContain('Bom dia Thiago,');
    expect(out).toContain('Com os melhores cumprimentos,');
    expect(out).toContain('Privacidade\n|\nTermos e Condições');
  });
  it('não deixa mais de uma linha vazia seguida, nem espaços no fim das linhas', () => {
    expect(out).not.toMatch(/\n{3,}/);
    expect(out).not.toMatch(/[ \t]+\n/);
    expect(out).toBe(out.trim());
  });
});

describe('cleanPlainText, textos normais', () => {
  it('não mexe num email simples', () => {
    expect(cleanPlainText('Olá,\n\nvemos-nos amanhã.\n\nAna')).toBe(
      'Olá,\n\nvemos-nos amanhã.\n\nAna'
    );
  });
  it('não tira [n] que não tem nota de rodapé (ex.: um "[1]" escrito à mão)', () => {
    expect(cleanPlainText('Ver ponto [1] do contrato')).toBe('Ver ponto [1] do contrato');
  });
  it('não tira a palavra "None" no meio do texto', () => {
    expect(cleanPlainText('None of the above [2]')).toBe('None of the above [2]');
  });
  it('mantém o endereço escrito no corpo (só saem as notas de rodapé numeradas)', () => {
    expect(cleanPlainText('Visite https://exemplo.pt hoje')).toBe('Visite https://exemplo.pt hoje');
  });
});
