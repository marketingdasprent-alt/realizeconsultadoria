import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NameSearchInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Caixa de pesquisa por nome do colaborador (filtra a lista no momento). */
export const NameSearchInput: React.FC<NameSearchInputProps> = ({
  id,
  value,
  onChange,
  className = '',
}) => (
  <div className={`space-y-1 ${className}`}>
    <Label htmlFor={id}>Pesquisar colaborador</Label>
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        type="search"
        placeholder="Nome do colaborador"
        className="pl-9 pr-9"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Limpar pesquisa"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  </div>
);
