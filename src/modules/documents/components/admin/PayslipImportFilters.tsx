import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const ALL_COMPANIES = '__all__';

interface PayslipImportFiltersProps {
  month: string;
  companyId: string;
  companies: Array<{ id: string; name: string }>;
  canImport: boolean;
  onMonthChange: (month: string) => void;
  onCompanyChange: (companyId: string) => void;
  onBulkFiles: (files: File[]) => void;
}

/** Mês, empresa e botão de importação em lote. */
export const PayslipImportFilters: React.FC<PayslipImportFiltersProps> = ({
  month,
  companyId,
  companies,
  canImport,
  onMonthChange,
  onCompanyChange,
  onBulkFiles,
}) => {
  const bulkInput = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="space-y-1">
        <Label htmlFor="ps-month">Mês</Label>
        <Input
          id="ps-month"
          type="month"
          className="sm:w-44"
          value={month}
          onChange={e => e.target.value && onMonthChange(e.target.value)}
        />
      </div>
      <div className="space-y-1 sm:w-64">
        <Label>Empresa</Label>
        <Select value={companyId} onValueChange={onCompanyChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_COMPANIES}>Todas as empresas</SelectItem>
            {companies.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {canImport && (
        <>
          <input
            ref={bulkInput}
            type="file"
            multiple
            accept="application/pdf"
            className="hidden"
            onChange={e => {
              if (e.target.files?.length) onBulkFiles(Array.from(e.target.files));
              e.target.value = '';
            }}
          />
          <Button className="sm:ml-auto" onClick={() => bulkInput.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Importar vários ficheiros
          </Button>
        </>
      )}
    </div>
  );
};
