import React from 'react';
import { Search, X } from 'lucide-react';

interface CompanyFilesSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

/** Pesquisa por nome nos ficheiros e pastas que estão à vista. */
export const CompanyFilesSearch: React.FC<CompanyFilesSearchProps> = ({
  value,
  onChange,
  placeholder,
}) => (
  <label className="relative flex h-9 w-full items-center sm:w-56">
    <Search className="pointer-events-none absolute left-3 h-4 w-4 text-rz-muted" />
    <input
      type="search"
      value={value}
      onChange={event => onChange(event.target.value)}
      onKeyDown={event => event.key === 'Escape' && onChange('')}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-full w-full rounded-full bg-rz-canvas pl-9 pr-8 text-[13px] outline-none ring-1 ring-rz-line placeholder:text-rz-muted focus:bg-white focus:ring-rz-primary/40 [&::-webkit-search-cancel-button]:hidden"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        className="absolute right-1.5 flex h-6 w-6 items-center justify-center rounded-full text-rz-muted hover:bg-white hover:text-rz-ink"
        aria-label="Limpar pesquisa"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </label>
);
