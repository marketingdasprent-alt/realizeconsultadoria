import { Loader2 } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { useMyCompanies } from '../hooks/useSharing';
import { legacySharingTarget } from '../lib/companyTabs';
import { inScope } from '../lib/companyScope';
import { managesCompany, sortCompanies } from '../lib/sharing';

/**
 * /admin/partilha (links antigos, notificações, emails) → Partilha da empresa em Empresas. A
 * página antiga abria na empresa escolhida no menu (ou na primeira que se administra): o destino
 * é o mesmo, e só de uma empresa que a conta administra. Sem nenhuma, a lista de Empresas.
 */
const LegacySharingRedirect = () => {
  const { search } = useLocation();
  const companies = useMyCompanies();
  const { ids: scopeIds, isLoading: scopeLoading } = useCompanyScope();
  const wantsGroups = new URLSearchParams(search).get('tab') === 'grupos';

  // Sem esperar pelo menu Empresa (a escolha) nem por uma lista vazia que ainda se está a atualizar,
  // abria-se a primeira empresa em vez da certa, ou a lista em vez da empresa.
  const waiting =
    companies.isLoading || scopeLoading || (companies.isFetching && !companies.data?.length);
  if (!wantsGroups && waiting) {
    return (
      <div role="status" className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-rz-primary" aria-hidden="true" />
        <span className="sr-only">A carregar…</span>
      </div>
    );
  }

  const adminOf = sortCompanies((companies.data ?? []).filter(item => managesCompany(item.role)));
  const scoped = adminOf.filter(item => inScope(scopeIds, item.company_id));
  const company = (scoped.length ? scoped : adminOf)[0]?.company_id ?? null;
  return <Navigate to={legacySharingTarget(search, company)} replace />;
};

export default LegacySharingRedirect;
