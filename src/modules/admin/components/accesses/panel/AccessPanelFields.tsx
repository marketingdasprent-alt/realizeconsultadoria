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
import type { CredentialsData } from '../../../services/credentialService';
import { PasswordInput } from './PasswordInput';
import { PeoplePicker } from './PeoplePicker';
import type { AccessForm } from './useAccessForm';

interface AccessPanelFieldsProps {
  form: AccessForm;
  errors: Partial<Record<keyof AccessForm, string>>;
  data: CredentialsData;
  domain: string | null;
  isEmail: boolean;
  update: (patch: Partial<AccessForm>) => void;
}

const NONE = '__none';

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
  update,
}) => {
  // Todos os ativos (um email pode ser de outra empresa do grupo); os da empresa primeiro.
  const employees = data.employees
    .filter(e => e.is_active)
    .sort(
      (a, b) =>
        Number(b.company_id === form.companyId) - Number(a.company_id === form.companyId) ||
        a.name.localeCompare(b.name)
    );
  const showSuffix = isEmail && !!domain && !form.local.includes('@');
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
            placeholder={isEmail ? 'nome' : 'utilizador ou email'}
            autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
          />
          {showSuffix && (
            <span className="shrink-0 border-l bg-rz-canvas px-3 py-2.5 text-sm text-rz-muted">
              @{domain}
            </span>
          )}
        </div>
      </Field>

      <Field id="acc-password" label="Palavra-passe *" error={errors.password}>
        <PasswordInput
          id="acc-password"
          value={form.password}
          onChange={password => update({ password })}
        />
      </Field>

      {form.kind === 'email_department' ? (
        <Field id="acc-people" label="Quem tem esta caixa no Webmail">
          <PeoplePicker
            employees={employees}
            companies={data.companies}
            preferCompanyId={form.companyId}
            value={form.people}
            onChange={people => update({ people })}
          />
        </Field>
      ) : (
        <Field
          id="acc-employee"
          label={form.kind === 'email_personal' ? 'Colaborador' : 'Colaborador (opcional)'}
        >
          <Select
            value={form.employeeId || NONE}
            onValueChange={value => update({ employeeId: value === NONE ? '' : value })}
          >
            <SelectTrigger id="acc-employee" className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhum</SelectItem>
              {employees.map(employee => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name}
                  {employee.user_id ? '' : ' (sem conta na app)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

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
