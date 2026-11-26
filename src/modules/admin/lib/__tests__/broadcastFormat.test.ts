import { describe, expect, it } from 'vitest';
import { applyFormat } from '../broadcastFormat';

const sel = (value: string, part: string) => {
  const start = value.indexOf(part);
  return [start, start + part.length] as const;
};

describe('applyFormat (botões e atalhos do comunicado)', () => {
  it('negrito na seleção, sem apanhar os espaços das pontas, e seleção no texto', () => {
    const value = 'Na segunda-feira muda';
    const [s, e] = sel(value, ' segunda-feira ');
    const r = applyFormat(value, s, e, 'bold');
    expect(r.value).toBe('Na **segunda-feira** muda');
    expect(r.value.slice(...r.selection)).toBe('segunda-feira');
  });

  it('carregar outra vez tira a formatação (desfazer)', () => {
    const r1 = applyFormat('Na segunda muda', 3, 10, 'italic');
    expect(r1.value).toBe('Na _segunda_ muda');
    const r2 = applyFormat(r1.value, ...r1.selection, 'italic');
    expect(r2.value).toBe('Na segunda muda');
    expect(r2.value.slice(...r2.selection)).toBe('segunda');
  });

  it('sem seleção: põe as marcas com o cursor no meio', () => {
    const r = applyFormat('Olá ', 4, 4, 'bold');
    expect(r.value).toBe('Olá ****');
    expect(r.selection).toEqual([6, 6]);
  });

  it('lista com pontos em todas as linhas da seleção, e outra vez tira', () => {
    const value = 'Passos:\num\ndois\nfim';
    const s = value.indexOf('m\ndois'); // seleção começa a meio de «um» e acaba em «dois»
    const r = applyFormat(value, s, value.indexOf('dois') + 2, 'bullets');
    expect(r.value).toBe('Passos:\n- um\n- dois\nfim');
    const back = applyFormat(r.value, ...r.selection, 'bullets');
    expect(back.value).toBe(value);
  });

  it('lista numerada numera 1, 2, 3 e troca uma lista com pontos', () => {
    const value = '- a\n- b\n- c';
    const r = applyFormat(value, 0, value.length, 'numbers');
    expect(r.value).toBe('1. a\n2. b\n3. c');
    expect(applyFormat(r.value, 0, r.value.length, 'numbers').value).toBe('a\nb\nc');
  });

  it('sem seleção, a lista começa na linha do cursor', () => {
    const value = 'Olá\ntexto';
    expect(applyFormat(value, 6, 6, 'bullets').value).toBe('Olá\n- texto');
  });
});
