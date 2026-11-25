// Secções de Empresas (a antiga "Partilha entre empresas" passou para aqui). Na ficha de cada empresa
// o utilizador vê três secções (Identidade, Equipa, Ligações com outras empresas: ver companySections.ts),
// mas o endereço guarda as chaves de sempre (?tab=dados|administradores|colaboradores|partilha), por
// isso todos os links antigos continuam a funcionar. A lista tem Empresas e, só para o super admin,
// Grupos e Equipa da plataforma. O estado vive no endereço (?tab= e ?sub=).
import { ROUTES } from '@/lib/constants';

export const COMPANY_TABS = ['dados', 'administradores', 'colaboradores', 'partilha'] as const;
export type CompanyTab = (typeof COMPANY_TABS)[number];

/** Dentro de Partilha: o que era cada separador da antiga página. */
export const SHARE_SUBS = ['codigo', 'pedidos', 'acesso', 'grupo', 'quem-ve'] as const;
export type ShareSub = (typeof SHARE_SUBS)[number];

export type ListTab = 'empresas' | 'grupos' | 'equipa';

/** Nomes em linguagem de utilizador que também se aceitam no endereço. */
const TAB_ALIASES: Record<string, CompanyTab> = {
  identidade: 'dados',
  equipa: 'administradores',
  ligacoes: 'partilha',
};

export const parseCompanyTab = (raw: string | null): CompanyTab => {
  const value = raw ?? '';
  if ((COMPANY_TABS as readonly string[]).includes(value)) return value as CompanyTab;
  return TAB_ALIASES[value] ?? 'dados';
};

export const parseShareSub = (raw: string | null): ShareSub =>
  (SHARE_SUBS as readonly string[]).includes(raw ?? '') ? (raw as ShareSub) : 'codigo';

/** "Grupos" e "Equipa" são do super admin: para os outros, qualquer outro ?tab= fica em Empresas. */
export const parseListTab = (raw: string | null, isSuperAdmin: boolean): ListTab => {
  if (!isSuperAdmin) return 'empresas';
  return raw === 'grupos' || raw === 'equipa' ? raw : 'empresas';
};

const companyPath = (companyId: string) => ROUTES.ADMIN.COMPANY_EDIT.replace(':id', companyId);

/** Endereço da Partilha de uma empresa (o Código é o sub-separador por omissão). */
export const companyPartilhaPath = (companyId: string, sub: ShareSub = 'codigo'): string =>
  `${companyPath(companyId)}?tab=partilha${sub === 'codigo' ? '' : `&sub=${sub}`}`;

/**
 * Para onde vai um link antigo de /admin/partilha (?tab=…). A página antiga escolhia a empresa
 * no ecrã, por isso o destino leva a empresa que ela abriria (ou a lista, se não houver nenhuma).
 */
export const legacySharingTarget = (search: string, companyId: string | null): string => {
  const tab = new URLSearchParams(search).get('tab');
  if (tab === 'grupos') return `${ROUTES.ADMIN.COMPANIES}?tab=grupos`;
  if (!companyId) return ROUTES.ADMIN.COMPANIES;
  return companyPartilhaPath(companyId, parseShareSub(tab));
};
