import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileUp, Search } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useEmployees } from '@/hooks/useEmployees';
import { matchesSearch } from '@/lib/utils';
import EmployeeFinancialTab from '../components/employee/EmployeeFinancialTab';
import { ImportPayslipsDialog } from '../components/employees/ImportPayslipsDialog';
import { companiesOf, companyName } from '../lib/employeeView';

/**
 * Financeiro: o processamento do mês (vencimento, subsídio, Cartão DÁ, km e ajudas de custo,
 * descontos), copiar do mês anterior, Excel, imprimir e importar os recibos.
 */
const FinancePage = () => {
  const { canExecuteTopic } = useAdminPermissions();
  const { employees, isLoading } = useEmployees();
  const [params, setParams] = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);
  const search = params.get('q') || '';
  const companyId = params.get('empresa') || 'all';

  const setParam = (key: string, value: string, fallback: string) =>
    setParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true }
    );

  const active = useMemo(() => employees.filter(e => e.is_active), [employees]);
  const companies = useMemo(() => companiesOf(active), [active]);
  const visible = useMemo(() => {
    const iban = search.replace(/\s/g, '').toLowerCase();
    return active
      .filter(e => companyId === 'all' || e.company_id === companyId)
      .filter(
        e =>
          matchesSearch(e.name, search) ||
          matchesSearch(companyName(e), search) ||
          (!!iban && (e.iban || '').replace(/\s/g, '').toLowerCase().includes(iban))
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  }, [active, search, companyId]);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Financeiro"
        description="Vencimentos, subsídios, ajudas de custo e descontos do mês"
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full bg-white px-4 text-rz-muted ring-1 ring-rz-line focus-within:ring-rz-primary/40">
          <Search className="h-4 w-4 shrink-0" />
          <input
            type="search"
            autoComplete="off"
            value={search}
            onChange={event => setParam('q', event.target.value, '')}
            placeholder="Procurar por nome, IBAN ou empresa"
            className="w-full bg-transparent text-[14px] text-rz-ink outline-none placeholder:text-rz-muted"
          />
        </label>
        <Select value={companyId} onValueChange={value => setParam('empresa', value, 'all')}>
          <SelectTrigger className="h-10 w-full rounded-full bg-white sm:w-[230px]">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {companies.map(company => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <EmployeeFinancialTab
        employees={visible}
        isLoading={isLoading}
        searchTerm={search}
        actions={
          canExecuteTopic('employees', 'edit') && (
            <Button variant="outline" className="rounded-full" onClick={() => setImportOpen(true)}>
              <FileUp className="h-4 w-4" /> Importar recibos
            </Button>
          )
        }
      />

      <ImportPayslipsDialog open={importOpen} onOpenChange={setImportOpen} employees={active} />
    </div>
  );
};

export default FinancePage;
