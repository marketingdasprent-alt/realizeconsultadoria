import React from 'react';
import { CompanySelect } from '@/components/admin/CompanySelect';
import type { MyCompany } from '../../lib/sharing';

interface CompanyPickerProps {
  id: string;
  companies: readonly MyCompany[];
  /** O id da empresa escolhida. */
  value: string;
  onChange: (companyId: string) => void;
}

/** Escolha da empresa na partilha: por ordem alfabética e com pesquisa. */
export const CompanyPicker: React.FC<CompanyPickerProps> = ({ id, companies, value, onChange }) => (
  <CompanySelect
    id={id}
    companies={companies.map(company => ({ id: company.company_id, name: company.name }))}
    value={value}
    onChange={onChange}
  />
);
