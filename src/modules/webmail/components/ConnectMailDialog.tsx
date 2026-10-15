import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useServerDiscovery } from '../hooks/useServerDiscovery';
import { domainOf } from '../lib/autodiscover';
import {
  IMAP_PRESETS,
  METHOD_TEXT,
  SUPPORTED_SMTP_PORT,
  providerOf,
  type MailProvider,
} from '../lib/providers';
import type { ImapConnectInput } from '../types';
import { FIELD, ImapServerFields, type ImapForm } from './ImapServerFields';

const formFor = (provider: MailProvider | null): ImapForm => {
  const preset = provider ? IMAP_PRESETS[provider.key] : undefined;
  return {
    email: '',
    password: '',
    imapHost: preset?.imapHost ?? '',
    imapPort: String(preset?.imapPort ?? 993),
    smtpHost: preset?.smtpHost ?? '',
    smtpPort: String(preset?.smtpPort ?? SUPPORTED_SMTP_PORT),
  };
};

interface ConnectMailDialogProps {
  provider: MailProvider | null;
  onClose: () => void;
  onOAuth: (provider: MailProvider) => Promise<void>;
  onImap: (input: ImapConnectInput) => Promise<boolean>;
  /** O domínio usa Google/Microsoft: trocar para o fornecedor certo. */
  onSwitch: (provider: MailProvider) => void;
}

/**
 * Ligar uma caixa: OAuth (Google/Microsoft) ou IMAP/SMTP com os servidores descobertos a
 * partir do endereço. Clicar fora não fecha, e o que foi escrito fica se voltar a abrir.
 */
export const ConnectMailDialog: React.FC<ConnectMailDialogProps> = ({
  provider,
  onClose,
  onOAuth,
  onImap,
  onSwitch,
}) => {
  const [form, setForm] = useState<ImapForm>(formFor(provider));
  const [advanced, setAdvanced] = useState(false);
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastKey = useRef<string | null>(null);
  const isImap = provider?.method === 'imap';
  const { discovery, isSearching } = useServerDiscovery(form.email, isImap && !edited);

  useEffect(() => {
    if (!provider || provider.key === lastKey.current) return;
    lastKey.current = provider.key;
    setForm(f => ({ ...formFor(provider), email: f.email }));
    setAdvanced(false);
    setEdited(false);
  }, [provider]);

  // Outro domínio: os servidores do anterior deixam de valer.
  const domain = domainOf(form.email);
  useEffect(() => {
    if (edited || !provider) return;
    const preset = formFor(provider);
    setForm(f => ({ ...preset, email: f.email, password: f.password }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o domínio muda
  }, [domain]);

  // Servidores encontrados entram no formulário (se a pessoa não os mudou à mão).
  useEffect(() => {
    if (!discovery?.servers || edited) return;
    const s = discovery.servers;
    setForm(f => ({
      ...f,
      imapHost: s.imapHost,
      imapPort: String(s.imapPort),
      smtpHost: s.smtpHost,
      smtpPort: String(s.smtpPort),
    }));
  }, [discovery, edited]);

  if (!provider) return null;

  const set = (key: keyof ImapForm, value: string) => {
    if (key !== 'email' && key !== 'password') setEdited(true);
    setForm(f => ({ ...f, [key]: value }));
  };
  const submit = async () => {
    setBusy(true);
    if (!isImap) await onOAuth(provider);
    else {
      const ok = await onImap({
        provider: provider.key,
        email: form.email.trim(),
        password: form.password,
        imapHost: form.imapHost.trim(),
        imapPort: Number(form.imapPort),
        smtpHost: form.smtpHost.trim(),
        smtpPort: Number(form.smtpPort),
      });
      if (ok) {
        lastKey.current = null;
        setForm(formFor(provider));
        onClose();
      }
    }
    setBusy(false);
  };
  const ready =
    !isImap ||
    (/\S+@\S+\.\S+/.test(form.email) &&
      form.password &&
      form.imapHost &&
      form.smtpHost &&
      Number(form.smtpPort) === SUPPORTED_SMTP_PORT);
  const suggestion = isImap && discovery?.oauth ? providerOf(discovery.oauth) : null;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent
        onInteractOutside={event => event.preventDefault()}
        className="max-h-[92vh] overflow-y-auto rounded-[28px] sm:max-w-md sm:rounded-[28px]"
      >
        <DialogHeader className="items-center text-center">
          <span className="mb-2 flex h-16 w-16 items-center justify-center rounded-[22px] bg-rz-canvas">
            <provider.Logo />
          </span>
          <DialogTitle className="text-xl font-extrabold">Ligar {provider.name}</DialogTitle>
          <DialogDescription className="text-[14px]">
            {METHOD_TEXT[provider.method]}
          </DialogDescription>
        </DialogHeader>

        {isImap && (
          <div className="space-y-3">
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="Endereço de email"
              autoComplete="off"
              className={FIELD}
            />
            {suggestion ? (
              <div className="rounded-2xl bg-rz-primary-soft px-4 py-3 text-[13px]">
                <p>
                  Este endereço usa <b>{suggestion.name}</b>. Ligue-o com a conta{' '}
                  {suggestion.method === 'oauth-google' ? 'Google' : 'Microsoft'} — sem
                  palavra-passe nem servidores.
                </p>
                <button
                  type="button"
                  onClick={() => onSwitch(suggestion)}
                  className="mt-2 inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 font-bold text-rz-primary shadow-rz-soft"
                >
                  <span className="flex h-5 w-5 items-center justify-center [&_svg]:h-5 [&_svg]:w-5">
                    <suggestion.Logo />
                  </span>
                  Ligar com {suggestion.name}
                </button>
              </div>
            ) : (
              <>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Palavra-passe (ou de aplicação)"
                  autoComplete="new-password"
                  className={FIELD}
                />
                <ImapServerFields
                  form={form}
                  onChange={set}
                  open={advanced}
                  onToggle={() => setAdvanced(v => !v)}
                  isSearching={isSearching}
                  source={edited ? null : (discovery?.source ?? null)}
                />
              </>
            )}
          </div>
        )}

        {!suggestion && (
          <button
            type="button"
            disabled={busy || !ready}
            onClick={submit}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {isImap ? 'Ligar caixa' : 'Continuar'}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
};
