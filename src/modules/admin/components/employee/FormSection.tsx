import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormSectionProps {
  title: string;
  icon: LucideIcon;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

/** Cartão de uma secção da ficha (Dados pessoais, Trabalho, Financeiro…). */
export const FormSection: React.FC<FormSectionProps> = ({
  title,
  icon: Icon,
  description,
  className,
  children,
}) => (
  <section
    className={cn(
      'rounded-[24px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line sm:p-6',
      className
    )}
  >
    <header className="mb-4 flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rz-primary-soft text-rz-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <h3 className="text-[15.5px] font-extrabold leading-tight">{title}</h3>
        {description && <p className="text-[12.5px] text-rz-muted">{description}</p>}
      </div>
    </header>
    {children}
  </section>
);

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Campo com etiqueta, ajuda e erro por baixo. */
export const Field: React.FC<FieldProps> = ({ label, error, hint, className, children }) => (
  <div className={className}>
    <label className="mb-1 block text-[13px] font-semibold text-rz-ink">{label}</label>
    {children}
    {error ? (
      <p className="mt-1 text-xs text-red-500">{error}</p>
    ) : (
      hint && <p className="mt-1 text-xs text-rz-muted">{hint}</p>
    )}
  </div>
);
