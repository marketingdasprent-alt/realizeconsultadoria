import React from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const;

/** Claro / Escuro / Sistema (o do computador ou telemóvel), guardado neste dispositivo. */
export const ThemeSwitch: React.FC<{ className?: string }> = ({ className }) => {
  const { theme = 'system', setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn('grid grid-cols-3 gap-1 rounded-2xl bg-rz-canvas p-1', className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[13px] font-semibold text-rz-muted transition-colors',
            theme === value ? 'bg-white text-rz-ink shadow-rz-soft' : 'hover:text-rz-ink'
          )}
        >
          <Icon className="h-4 w-4" /> {label}
        </button>
      ))}
    </div>
  );
};

const NEXT: Record<string, string> = { light: 'dark', dark: 'system', system: 'light' };

/** Botão pequeno que roda entre Claro → Escuro → Sistema (menu do admin, sobre a aurora). */
export const ThemeCycleButton: React.FC<{ className?: string }> = ({ className }) => {
  const { theme = 'system', setTheme } = useTheme();
  const current = OPTIONS.find(option => option.value === theme) ?? OPTIONS[2];
  const Icon = current.icon;
  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[current.value])}
      className={className}
      aria-label={`Tema: ${current.label}`}
      title={`Tema: ${current.label} (clique para mudar)`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
};
