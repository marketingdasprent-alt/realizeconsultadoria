import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { CompanyAvailability } from '../../lib/sharing';

interface GroupCompanyChecklistProps {
  /** Prefixo único dos ids (há mais do que uma lista no ecrã). */
  idPrefix: string;
  items: readonly CompanyAvailability[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/** Escolha das empresas de um grupo. As que já estão noutro grupo ficam recusadas, com o motivo. */
export const GroupCompanyChecklist: React.FC<GroupCompanyChecklistProps> = ({
  idPrefix,
  items,
  value,
  onChange,
  disabled,
}) => {
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter(item => item !== id));

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-semibold">Empresas do grupo</legend>
      <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
        {items.map(item => {
          const id = `${idPrefix}-${item.id}`;
          const reasonId = `${id}-reason`;
          return (
            <li key={item.id} className="flex items-start gap-3 rounded px-2 py-1.5">
              <Checkbox
                id={id}
                className="mt-0.5"
                checked={value.includes(item.id)}
                disabled={!!item.reason}
                aria-describedby={item.reason ? reasonId : undefined}
                onCheckedChange={checked => toggle(item.id, checked === true)}
              />
              <div className="min-w-0">
                <Label htmlFor={id} className="cursor-pointer text-sm font-medium leading-snug">
                  {item.name}
                </Label>
                {item.reason && (
                  <p id={reasonId} className="text-xs text-muted-foreground">
                    {item.reason}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
};
