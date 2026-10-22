import React from 'react';
import { AlertTriangle, BellRing, RefreshCw, Unplug, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT_DOTS } from '../lib/mailFormat';
import type { MailAccount, MailAccountColor } from '../types';

const FIELD =
  'h-11 w-full rounded-2xl bg-rz-canvas px-4 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40';
const LABEL = 'mb-1.5 block text-[13px] font-bold';
const HINT = 'mt-1 block text-[12px] text-rz-muted';
const COLORS = Object.keys(ACCOUNT_DOTS) as MailAccountColor[];

export interface AccountForm {
  displayName: string;
  label: string;
  color: MailAccountColor;
  isDefault: boolean;
  notify: boolean;
}

interface TabProps {
  account: MailAccount;
  form: AccountForm;
  setForm: React.Dispatch<React.SetStateAction<AccountForm>>;
}

/** Separador "Geral": nome da caixa, remetente, cor e predefinida. */
export const GeneralTab: React.FC<TabProps> = ({ account, form, setForm }) => (
  <div className="max-w-xl space-y-5">
    {account.shared && (
      <p className="flex gap-2 rounded-2xl bg-rz-primary-soft px-4 py-3 text-[13px]">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-rz-primary" />
        Caixa partilhada pela empresa: quem tem acesso e a ligação são geridos pelo administrador. O
        nome, as assinaturas, a cor e os avisos aqui são só seus.
      </p>
    )}
    <label className="block">
      <span className={LABEL}>Nome da caixa</span>
      <input
        value={form.label}
        onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
        placeholder={account.email}
        maxLength={60}
        className={FIELD}
      />
      <span className={HINT}>
        Como aparece na sua barra lateral{account.shared ? ' (só para si)' : ''}. Deixe vazio para
        mostrar o endereço.
      </span>
    </label>
    {!account.shared && (
      <label className="block">
        <span className={LABEL}>Nome do remetente</span>
        <input
          value={form.displayName}
          onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
          className={FIELD}
        />
        <span className={HINT}>O nome que quem recebe os seus emails vê.</span>
      </label>
    )}
    <div>
      <span className={LABEL}>Cor</span>
      <div className="flex gap-2">
        {COLORS.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => setForm(f => ({ ...f, color }))}
            className={cn(
              'h-8 w-8 rounded-full ring-offset-2',
              ACCOUNT_DOTS[color],
              form.color === color && 'ring-2 ring-rz-ink'
            )}
            aria-label={color}
          />
        ))}
      </div>
    </div>
    {!account.shared && (
      <label className="flex items-center gap-3 text-[14px] font-semibold">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
          className="h-5 w-5 accent-violet-600"
        />
        Caixa predefinida para escrever
      </label>
    )}
  </div>
);

/** Separador "Avisos": notificação de email novo. */
export const NoticesTab: React.FC<TabProps> = ({ account, form, setForm }) => (
  <label className="flex max-w-xl items-start gap-3 rounded-2xl bg-rz-canvas px-4 py-4">
    <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-rz-primary" />
    <span className="flex-1">
      <span className="block text-[14px] font-semibold">Avisar emails novos</span>
      <span className="block text-[12.5px] text-rz-muted">
        Notificação no Realize e no telemóvel quando chega um email a esta caixa
        {account.shared ? ' (só para si)' : ''}.
      </span>
    </span>
    <input
      type="checkbox"
      role="switch"
      checked={form.notify}
      onChange={e => setForm(f => ({ ...f, notify: e.target.checked }))}
      className="mt-1 h-5 w-5 accent-violet-600"
      aria-label="Avisar emails novos desta caixa"
    />
  </label>
);

interface ConnectionTabProps {
  account: MailAccount;
  onReconnect: () => void;
  onDisconnect: () => void;
}

/** Separador "Ligação": estado, voltar a ligar e desligar. */
export const ConnectionTab: React.FC<ConnectionTabProps> = ({
  account,
  onReconnect,
  onDisconnect,
}) => (
  <div className="max-w-xl space-y-4">
    {account.status === 'active' ? (
      <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
        Ligada e a sincronizar.
      </p>
    ) : (
      <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="flex-1">
          {account.status === 'reauth'
            ? 'A autorização expirou.'
            : (account.lastError ?? 'Houve um erro ao sincronizar.')}
        </span>
      </div>
    )}
    {account.shared ? (
      <p className="text-[13px] text-rz-muted">
        A ligação desta caixa é gerida pelo administrador. Se deixar de funcionar, fale com ele.
      </p>
    ) : (
      <div className="flex flex-wrap gap-2">
        {account.authMethod !== 'imap' && (
          <button
            type="button"
            onClick={onReconnect}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-rz-canvas px-5 text-[13.5px] font-bold hover:bg-rz-primary-soft"
          >
            <RefreshCw className="h-4 w-4" /> Voltar a ligar
          </button>
        )}
        <button
          type="button"
          onClick={onDisconnect}
          className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-bold text-rose-600 hover:bg-rose-50"
        >
          <Unplug className="h-4 w-4" /> Desligar caixa
        </button>
      </div>
    )}
  </div>
);
