import { describe, expect, it } from 'vitest';
import { canonicalLabels, compareText, fold, matchesText, sameText } from '../text';

describe('texto sem maiúsculas nem acentos', () => {
  it('fold ignora maiúsculas, acentos e espaços a mais', () => {
    expect(fold('  Ação  JURÍDICA ')).toBe('acao juridica');
    expect(fold(null)).toBe('');
  });

  it('matchesText encontra "ferias" em "Férias" e aceita termo vazio', () => {
    expect(matchesText('ferias', 'Férias e ausências')).toBe(true);
    expect(matchesText('JOSE', null, 'José Silva')).toBe(true);
    expect(matchesText('', 'qualquer')).toBe(true);
    expect(matchesText('xyz', 'José Silva')).toBe(false);
  });

  it('sameText e compareText', () => {
    expect(sameText('Contabilidade', 'contabilidade')).toBe(true);
    expect(sameText('Jurídico', 'juridico')).toBe(true);
    expect(['Óscar', 'ana', 'Bruno'].sort(compareText)).toEqual(['ana', 'Bruno', 'Óscar']);
  });

  it('canonicalLabels junta variantes e prefere a que começa em maiúscula', () => {
    const labels = canonicalLabels(['contabilidade', 'Contabilidade', 'contabilidade', null, ' ']);
    expect(labels.size).toBe(1);
    expect(labels.get('contabilidade')).toBe('Contabilidade');
  });
});
