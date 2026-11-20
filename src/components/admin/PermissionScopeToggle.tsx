import { cn } from '@/lib/utils';
import type { PermissionScope } from '@/lib/permissions-config';

const OPTIONS: { value: PermissionScope; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'team', label: 'Só a minha equipa' },
];

interface PermissionScopeToggleProps {
  /** null: nenhuma opção marcada (ex.: funcionalidades com alcances diferentes). */
  value: PermissionScope | null;
  onChange: (value: PermissionScope) => void;
  disabled?: boolean;
  /** Nome acessível do grupo de opções (ex.: "Alcance de Editar colaboradores"). */
  label: string;
  className?: string;
}

/** Escolha do alcance de uma permissão: toda a empresa ou só a equipa de quem a tem. */
export const PermissionScopeToggle = ({
  value,
  onChange,
  disabled,
  label,
  className,
}: PermissionScopeToggleProps) => (
  <div
    role="radiogroup"
    aria-label={label}
    className={cn(
      'inline-flex rounded-full bg-muted p-0.5 text-xs',
      disabled && 'opacity-50',
      className
    )}
  >
    {OPTIONS.map((option, index) => {
      const selected = option.value === value;
      // Padrão radiogroup: uma só paragem de Tab (a opção marcada, ou a 1.ª) e setas para mudar.
      const focusable = value === null ? index === 0 : selected;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={selected}
          tabIndex={focusable ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          onKeyDown={event => {
            const step = ['ArrowRight', 'ArrowDown'].includes(event.key)
              ? 1
              : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                ? -1
                : 0;
            if (!step) return;
            event.preventDefault();
            const next = OPTIONS[(index + step + OPTIONS.length) % OPTIONS.length];
            onChange(next.value);
            const buttons = event.currentTarget.parentElement?.querySelectorAll('button');
            (buttons?.[OPTIONS.indexOf(next)] as HTMLButtonElement | undefined)?.focus();
          }}
          className={cn(
            'min-h-8 rounded-full px-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
            disabled && 'cursor-not-allowed'
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
