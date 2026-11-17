import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { groupGrantable, type Capability } from '../../lib/sharing';

interface CapabilityPickerProps {
  /** Prefixo único dos ids (há mais do que um seletor no ecrã). */
  idPrefix: string;
  catalog: readonly Capability[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/** Escolha das permissões partilháveis, agrupadas por módulo. As sensíveis vêm assinaladas. */
export const CapabilityPicker: React.FC<CapabilityPickerProps> = ({
  idPrefix,
  catalog,
  value,
  onChange,
  disabled,
}) => {
  const toggle = (capability: string, checked: boolean) =>
    onChange(checked ? [...value, capability] : value.filter(item => item !== capability));

  return (
    <div className="space-y-4">
      {groupGrantable(catalog).map(group => (
        <fieldset key={group.module} className="space-y-2" disabled={disabled}>
          <legend className="text-sm font-semibold">{group.label}</legend>
          {group.items.map(item => {
            const id = `${idPrefix}-${item.capability}`;
            return (
              <div key={item.capability} className="flex items-start gap-3">
                <Checkbox
                  id={id}
                  className="mt-0.5"
                  checked={value.includes(item.capability)}
                  onCheckedChange={checked => toggle(item.capability, checked === true)}
                />
                <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-snug">
                  {item.description ?? item.capability}
                  {item.sensitive && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (sensível: pede a sua palavra-passe)
                    </span>
                  )}
                </Label>
              </div>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
};
