import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RzSelect } from '@/modules/workspace/components/RzSelect';
import { supportService } from '../services/supportService';

const KEY = 'rz.mail.supportCompany';

const remembered = () => {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};

interface CompanyPickerProps {
  value: string;
  onChange: (company: { id: string; name: string } | null) => void;
}

/**
 * Realize Mail (clientes de fora): a empresa do cliente, para o ticket chegar ao admin com ela.
 * Lembra a última escolhida neste aparelho.
 */
export const CompanyPicker: React.FC<CompanyPickerProps> = ({ value, onChange }) => {
  const { data: companies = [] } = useQuery({
    queryKey: ['support', 'companies'],
    queryFn: async () => (await supportService.listCompanies()).data,
    staleTime: 30 * 60_000,
  });

  // Primeira vez que abre: a empresa da última vez (se ainda existir)
  useEffect(() => {
    if (value || !companies.length) return;
    const last = companies.find(c => c.id === remembered());
    if (last) onChange(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando a lista chega
  }, [companies]);

  return (
    <div>
      <span className="mb-2 block text-[13px] font-bold">A sua empresa</span>
      <RzSelect
        value={value}
        placeholder="Escolha a empresa"
        options={companies.map(c => ({ value: c.id, label: c.name }))}
        onChange={id => {
          const company = companies.find(c => c.id === id) ?? null;
          try {
            if (company) localStorage.setItem(KEY, company.id);
          } catch {
            // sem armazenamento: escolhe-se de cada vez
          }
          onChange(company);
        }}
      />
    </div>
  );
};
