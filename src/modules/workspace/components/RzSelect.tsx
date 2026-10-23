import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RzSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Classe de cor de uma bolinha antes do texto (ex.: 'bg-emerald-500'). */
  dot?: string;
}

interface RzSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: RzSelectOption[];
  /** Classes do botão (altura, fundo, cantos…); a seta e o alinhamento são do componente. */
  className?: string;
  /** Texto quando nada está escolhido. */
  placeholder?: string;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  align?: 'start' | 'center' | 'end';
}

// O Radix não aceita "" como valor de uma opção: "Não repete", "Sem lembrete"… usam este.
const EMPTY = '__rz_empty__';
const toRadix = (value: string) => (value === '' ? EMPTY : value);

/** Seletor da Realize: abre uma lista com o mesmo aspeto dos menus (em vez do nativo). */
export const RzSelect: React.FC<RzSelectProps> = ({
  value,
  onChange,
  options,
  className,
  placeholder,
  ariaLabel,
  title,
  disabled,
  align = 'start',
}) => {
  const hasEmpty = options.some(option => option.value === '');
  const current = options.find(option => option.value === value);

  return (
    <SelectPrimitive.Root
      value={hasEmpty || value !== '' ? toRadix(value) : ''}
      onValueChange={next => onChange(next === EMPTY ? '' : next)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        title={title}
        className={cn(
          'inline-flex items-center justify-between gap-2 text-left outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-rz-muted',
          className
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {current?.dot && <span className={cn('h-2 w-2 shrink-0 rounded-full', current.dot)} />}
          <span className="truncate">
            <SelectPrimitive.Value placeholder={placeholder} />
          </span>
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          align={align}
          sideOffset={6}
          className="z-[200] max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl bg-white p-1.5 text-rz-ink shadow-rz-pop ring-1 ring-rz-line data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <SelectPrimitive.Viewport className="rz-scroll max-h-[inherit] overflow-y-auto">
            {options.map(option => (
              <SelectPrimitive.Item
                key={option.value || EMPTY}
                value={toRadix(option.value)}
                disabled={option.disabled}
                className="relative flex cursor-pointer select-none items-center gap-2.5 rounded-xl py-2 pl-2.5 pr-8 text-[13.5px] font-medium outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-rz-canvas data-[state=checked]:font-bold data-[state=checked]:text-rz-primary data-[disabled]:opacity-40"
              >
                {option.dot && <span className={cn('h-2 w-2 shrink-0 rounded-full', option.dot)} />}
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2.5">
                  <Check className="h-4 w-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
};
