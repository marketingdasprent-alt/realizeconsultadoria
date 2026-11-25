// As três secções que o utilizador vê na ficha da empresa, e a que chave do endereço (?tab=) cada
// uma corresponde. Equipa junta Administradores e Colaboradores (a última escolhida é a que abre).
import type { CompanyTab } from './companyTabs';

export const COMPANY_SECTIONS = ['identidade', 'equipa', 'ligacoes'] as const;
export type CompanySection = (typeof COMPANY_SECTIONS)[number];

export const SECTION_LABEL: Record<CompanySection, string> = {
  identidade: 'Identidade',
  equipa: 'Equipa',
  ligacoes: 'Ligações com outras empresas',
};

export type TeamTab = Extract<CompanyTab, 'administradores' | 'colaboradores'>;

export const sectionOf = (tab: CompanyTab): CompanySection => {
  if (tab === 'dados') return 'identidade';
  if (tab === 'partilha') return 'ligacoes';
  return 'equipa';
};

/** A chave do endereço da secção; Equipa abre onde a pessoa estava (Administradores por omissão). */
export const tabOfSection = (
  section: CompanySection,
  lastTeamTab: TeamTab = 'administradores'
): CompanyTab => {
  if (section === 'identidade') return 'dados';
  if (section === 'ligacoes') return 'partilha';
  return lastTeamTab;
};
