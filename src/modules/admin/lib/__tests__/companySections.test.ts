import { describe, expect, it } from 'vitest';
import { COMPANY_TABS, parseCompanyTab, type CompanyTab } from '../companyTabs';
import {
  COMPANY_SECTIONS,
  SECTION_LABEL,
  sectionOf,
  tabOfSection,
  type TeamTab,
} from '../companySections';

describe('companySections', () => {
  describe('sectionOf', () => {
    it.each<[CompanyTab, string]>([
      ['dados', 'identidade'],
      ['administradores', 'equipa'],
      ['colaboradores', 'equipa'],
      ['partilha', 'ligacoes'],
    ])('a chave ?tab=%s pertence à secção %s', (tab, section) => {
      expect(sectionOf(tab)).toBe(section);
    });

    it('cobre todas as chaves antigas do endereço', () => {
      for (const tab of COMPANY_TABS) {
        expect(COMPANY_SECTIONS).toContain(sectionOf(tab));
      }
    });
  });

  describe('tabOfSection', () => {
    it('Identidade abre em dados e Ligações em partilha', () => {
      expect(tabOfSection('identidade')).toBe('dados');
      expect(tabOfSection('ligacoes')).toBe('partilha');
    });

    it('Identidade e Ligações ignoram a última aba da equipa', () => {
      expect(tabOfSection('identidade', 'colaboradores')).toBe('dados');
      expect(tabOfSection('ligacoes', 'colaboradores')).toBe('partilha');
    });

    it('Equipa abre em Administradores por omissão', () => {
      expect(tabOfSection('equipa')).toBe('administradores');
    });

    it.each<TeamTab>(['administradores', 'colaboradores'])(
      'Equipa abre onde a pessoa estava (%s)',
      last => {
        expect(tabOfSection('equipa', last)).toBe(last);
      }
    );
  });

  describe('ida e volta', () => {
    it.each(['dados', 'administradores', 'colaboradores', 'partilha'] as const)(
      'o link antigo ?tab=%s volta à mesma chave depois de passar pela secção',
      tab => {
        const section = sectionOf(parseCompanyTab(tab));
        const lastTeamTab: TeamTab = tab === 'colaboradores' ? 'colaboradores' : 'administradores';
        expect(tabOfSection(section, lastTeamTab)).toBe(tab);
      }
    );

    it.each(COMPANY_SECTIONS)(
      'a secção %s volta a si própria depois de passar pela chave',
      section => {
        expect(sectionOf(tabOfSection(section))).toBe(section);
        expect(sectionOf(tabOfSection(section, 'colaboradores'))).toBe(section);
      }
    );

    it('os nomes em linguagem de utilizador do endereço dão a mesma secção', () => {
      expect(sectionOf(parseCompanyTab('identidade'))).toBe('identidade');
      expect(sectionOf(parseCompanyTab('equipa'))).toBe('equipa');
      expect(sectionOf(parseCompanyTab('ligacoes'))).toBe('ligacoes');
    });

    it('um ?tab= desconhecido ou em falta cai na secção Identidade', () => {
      expect(sectionOf(parseCompanyTab('xpto'))).toBe('identidade');
      expect(sectionOf(parseCompanyTab(null))).toBe('identidade');
    });
  });

  it('cada secção tem a sua etiqueta em português', () => {
    expect(SECTION_LABEL).toEqual({
      identidade: 'Identidade',
      equipa: 'Equipa',
      ligacoes: 'Ligações com outras empresas',
    });
  });
});
