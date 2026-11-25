import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { CompanyLogo } from '@/components/admin/CompanyLogo';
import { Badge } from '@/components/ui/badge';
import { companyLabel } from '@/lib/companyName';

interface CompanyHeaderProps {
  company: {
    name: string;
    nif: string;
    is_active: boolean;
    logo_path: string | null;
  } | null;
  /** O grupo (ou "Em grupo"); null se não está em nenhum. */
  group: string | null;
  /** null enquanto carrega ou se a conta não pode saber. */
  admins: number | null;
  employees: number | null;
  onBack: () => void;
}

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-[96px]">
    <dt className="text-xs text-rz-muted">{label}</dt>
    <dd className="text-[15px] font-semibold">{value}</dd>
  </div>
);

/** Cabeçalho da ficha: logo grande, nome e os números que se procuram primeiro. */
export const CompanyHeader: React.FC<CompanyHeaderProps> = ({
  company,
  group,
  admins,
  employees,
  onBack,
}) => (
  <header className="flex flex-col gap-4 rounded-2xl border p-5 shadow-card sm:flex-row sm:items-center">
    <button
      type="button"
      onClick={onBack}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-white hover:text-rz-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rz-primary"
      aria-label="Voltar às empresas"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
    {company ? (
      <>
        <CompanyLogo name={company.name} logoPath={company.logo_path} size="lg" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-[26px] font-bold leading-tight tracking-tight">
              {companyLabel(company.name)}
            </h1>
            <Badge variant={company.is_active ? 'default' : 'secondary'}>
              {company.is_active ? 'Ativa' : 'Desativada'}
            </Badge>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            <Fact label="NIF" value={company.nif} />
            <Fact label="Grupo" value={group ?? 'Sem grupo'} />
            <Fact label="Administradores" value={admins === null ? '—' : String(admins)} />
            <Fact label="Colaboradores" value={employees === null ? '—' : String(employees)} />
          </dl>
        </div>
      </>
    ) : (
      <h1 className="text-[26px] font-bold leading-tight tracking-tight">Nova empresa</h1>
    )}
  </header>
);
