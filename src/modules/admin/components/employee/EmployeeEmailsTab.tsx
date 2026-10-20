import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, Mail, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmployeeEmails } from '../../hooks/useEmployeeEmails';
import { mailboxState } from '../../lib/credentials';
import type { EmployeeEmail } from '../../lib/emailRows';
import { AccessPanel } from '../accesses/panel/AccessPanel';
import type { AccessPanelTarget } from '../accesses/panel/useAccessForm';
import { EmployeeEmailPicker } from './EmployeeEmailPicker';
import { FileSection } from './files/FileRow';

const STATE = {
  linked: { label: 'Ligada', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700' },
  error: { label: 'Com erro', icon: AlertTriangle, className: 'bg-rose-50 text-rose-700' },
  pending: { label: 'Por ligar', icon: CircleDashed, className: 'bg-amber-50 text-amber-800' },
  nobody: {
    label: 'Sem conta na app',
    icon: CircleDashed,
    className: 'bg-rz-canvas text-rz-muted',
  },
};

const EmailItem: React.FC<{
  email: EmployeeEmail;
  hasAccount: boolean;
  busy: boolean;
  onTest: () => void;
  onRemove: () => void;
}> = ({ email, hasAccount, busy, onTest, onRemove }) => {
  const state = STATE[mailboxState(email.mailbox, hasAccount ? 1 : 0)];
  const Icon = state.icon;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl p-2.5 hover:bg-rz-canvas">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rz-primary-soft text-rz-primary">
        <Mail className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-[14px] font-semibold">{email.credential.username}</p>
        <p className="truncate text-[12.5px] text-rz-muted">
          {email.role === 'owner'
            ? 'Email pessoal dele'
            : email.department
              ? 'Departamental · partilhado'
              : 'Pessoal de outra pessoa · partilhado'}
          {email.credential.companies?.name ? ` · ${email.credential.companies.name}` : ''}
        </p>
      </div>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
          state.className
        )}
        title={email.mailbox?.last_error ?? undefined}
      >
        <Icon className="h-3.5 w-3.5" /> {state.label}
      </span>
      {hasAccount && (
        <button
          type="button"
          onClick={onTest}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[12.5px] font-semibold ring-1 ring-rz-line hover:bg-rz-canvas disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {email.mailbox ? 'Testar' : 'Ligar'}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        aria-label={`Tirar ${email.credential.username}`}
        title="Tirar deste colaborador"
        className="flex h-9 w-9 items-center justify-center rounded-full text-rz-muted hover:bg-rose-50 hover:text-rose-600"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
};

/** Ficha do colaborador → Emails: as caixas que vê no Webmail e ligar mais (dos Acessos). */
const EmployeeEmailsTab: React.FC<{ employeeId: string }> = ({ employeeId }) => {
  const { data, employee, emails, busy, add, remove, test } = useEmployeeEmails(employeeId);
  const [picking, setPicking] = useState(false);
  const [panel, setPanel] = useState<AccessPanelTarget | null>(null);
  const hasAccount = !!employee?.user_id;

  return (
    <FileSection
      title="Emails"
      description={
        hasAccount
          ? 'As caixas que o colaborador vê no Webmail. Vêm dos Acessos: o email pessoal dele e os que partilha.'
          : 'Ainda não tem conta na app: os emails ficam ligados e aparecem no Webmail quando entrar.'
      }
      count={emails.length}
      action={
        <button
          type="button"
          onClick={() => setPicking(v => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rz-primary px-4 text-[13px] font-bold text-white"
        >
          <Plus className="h-4 w-4" /> Ligar email
        </button>
      }
    >
      {picking && employee && (
        <EmployeeEmailPicker
          employee={employee}
          data={data}
          busy={busy}
          onAdd={credential => void add(credential)}
          onCreate={() =>
            setPanel({ kind: 'email_personal', companyId: employee.company_id, employeeId })
          }
        />
      )}
      {data.isLoading ? (
        <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-rz-primary" />
      ) : emails.length === 0 ? (
        <p className="px-2 py-6 text-center text-[13.5px] text-rz-muted">
          Ainda sem emails. Em "Ligar email" escolha um dos Acessos ou crie um novo.
        </p>
      ) : (
        <ul>
          {emails.map(email => (
            <EmailItem
              key={email.credential.id}
              email={email}
              hasAccount={hasAccount}
              busy={busy === email.credential.id}
              onTest={() => void test(email)}
              onRemove={() => void remove(email)}
            />
          ))}
        </ul>
      )}
      <AccessPanel
        target={panel}
        data={data}
        onClose={() => setPanel(null)}
        onSaved={() => void data.refresh()}
      />
    </FileSection>
  );
};

export default EmployeeEmailsTab;
