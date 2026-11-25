import React from 'react';
import { cn } from '@/lib/utils';
import { CompanyAdminsSection } from '../CompanyAdminsSection';
import { CompanyEmployeesSection } from '../CompanyEmployeesSection';
import type { TeamTab } from '../../lib/companySections';

interface CompanyTeamSectionProps {
  company: { id: string; name: string; isActive: boolean };
  tab: TeamTab;
  onTab: (tab: TeamTab) => void;
}

const OPTIONS: ReadonlyArray<{ value: TeamTab; label: string }> = [
  { value: 'administradores', label: 'Administradores' },
  { value: 'colaboradores', label: 'Colaboradores' },
];

/** Equipa da empresa: quem a administra e quem lá trabalha, num só sítio. */
export const CompanyTeamSection: React.FC<CompanyTeamSectionProps> = ({ company, tab, onTab }) => (
  <div className="space-y-4">
    <div className="inline-flex rounded-full border p-1" role="group" aria-label="Equipa">
      {OPTIONS.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={tab === option.value}
          onClick={() => onTab(option.value)}
          className={cn(
            'h-9 rounded-full px-4 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rz-primary',
            tab === option.value
              ? 'bg-rz-ink text-white'
              : 'text-rz-muted hover:bg-white hover:text-rz-ink'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
    <div className="rounded-2xl border p-5 shadow-card">
      {tab === 'administradores' ? (
        <CompanyAdminsSection company={{ id: company.id, name: company.name }} />
      ) : (
        <CompanyEmployeesSection company={company} />
      )}
    </div>
  </div>
);
