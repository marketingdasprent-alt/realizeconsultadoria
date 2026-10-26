import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RzSelect } from '@/modules/workspace/components/RzSelect';
import { NO_COMPANY } from '../../../lib/credentials';
import type { CredentialsData } from '../../../services/credentialService';
import { PasswordInput } from './PasswordInput';
import type { AccessForm } from './useAccessForm';

interface AccessPanelFieldsProps {
  form: AccessForm;
  errors: Partial<Record<keyof AccessForm, string>>;
  data: CredentialsData;
  domain: string | null;
  isEmail: boolean;
  /** A editar: a palavra-passe só muda se escrever uma nova. */
  editing: boolean;
  update: (patch: Partial<AccessForm>) => void;
}

const Field: React.FC<{ id: string; label: string; error?: string; children: React.ReactNode }> = ({
  id,
  label,
  error,
  children,
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-[13px] font-semibold">
      {label}
    </Label>
    {children}
    {error && <p className="text-[12px] text-destructive">{error}</p>}
  </div>
);

/** Campos do painel, conforme o tipo (email pessoal/departamental, site, outro). */
export const AccessPanelFields: React.FC<AccessPanelFieldsProps> = ({
  form,
  errors,
  data,
  domain,
  isEmail,
  editing,
  update,
}) => {
  // Domínio da empresa por omissão; "Outro domínio" deixa escrever o endereço todo (gmail, sapo…).
  const free = form.otherDomain || !domain;
  const showDomain = isEmail && !!domain && !form.local.includes('@');
  return (
    <div className="space-y-4">
      <Field id="acc-company" label="Empresa *" error={errors.companyId}>
        <Select
          value={form.companyId || undefined}
          onValueChange={companyId => update({ companyId })}
        >
          <SelectTrigger id="acc-company" className="h-10">
            <SelectValue placeholder="Escolha a empresa" />
          </SelectTrigger>
          <SelectContent>
            {data.companies.map(company => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
            <SelectItem value={NO_COMPANY}>Outro (sem empresa · gmail, sapo…)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {!isEmail && (
        <>
          <Field id="acc-title" label="Nome *" error={errors.title}>
            <Input
              id="acc-title"
              value={form.title}
              onChange={e => update({ title: e.target.value })}
              placeholder="Ex.: Portal das Finanças"
              className="h-10"
            />
          </Field>
          <Field id="acc-url" label="Endereço do site">
            <Input
              id="acc-url"
              value={form.url}
              onChange={e => update({ url: e.target.value })}
              placeholder="https://"
              className="h-10"
            />
          </Field>
        </>
      )}

      <Field
        id="acc-user"
        label={isEmail ? 'Endereço de email *' : 'Utilizador *'}
        error={errors.local}
      >
        <div className="flex items-center overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
          <input
            id="acc-user"
            value={form.local}
            onChange={e => update({ local: e.target.value })}
            placeholder={isEmail ? (free ? 'nome@gmail.com' : 'nome') : 'utilizador ou email'}
            autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
          />
          {(showDomain || (isEmail && form.otherDomain)) && domain && (
            <RzSelect
              value={form.otherDomain ? 'other' : 'company'}
              onChange={value => {
                const otherDomain = value === 'other';
                update({
                  otherDomain,
                  // Ao voltar ao domínio da empresa, fica só a parte antes do @.
                  local: otherDomain ? form.local : form.local.split('@')[0],
                });
              }}
              ariaLabel="Domínio do email"
              align="end"
              className="h-10 shrink-0 border-l bg-rz-canvas px-3 text-sm text-rz-muted"
              options={[
                { value: 'company', label: `@${domain}` },
                { value: 'other', label: 'Outro (gmail, sapo…)' },
              ]}
            />
          )}
        </div>
      </Field>

      <Field
        id="acc-password"
        label={editing ? 'Nova palavra-passe' : 'Palavra-passe *'}
        error={errors.password}
      >
        <PasswordInput
          id="acc-password"
          value={form.password}
          onChange={password => update({ password })}
          placeholder={editing ? 'Deixe vazio para manter a atual' : undefined}
        />
      </Field>

      {isEmail && (
        <Field id="acc-title" label="Nome (opcional)">
          <Input
            id="acc-title"
            value={form.title}
            onChange={e => update({ title: e.target.value })}
            placeholder={
              form.kind === 'email_personal' ? 'Email do colaborador' : 'Ex.: Geral, Faturação'
            }
            className="h-10"
          />
        </Field>
      )}

      <Field id="acc-notes" label="Notas">
        <Textarea
          id="acc-notes"
          value={form.notes}
          onChange={e => update({ notes: e.target.value })}
          rows={2}
        />
      </Field>
    </div>
  );
};
