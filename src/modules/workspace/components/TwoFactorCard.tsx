import React, { useEffect, useState } from 'react';
import { Check, Copy, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { MfaCodeForm } from '@/modules/auth/components/MfaCodeForm';
import { groupSecret, isMfaUnavailable, mfaErrorMessage, qrSource } from '@/modules/auth/lib/mfa';
import { mfaService, type Enrollment } from '@/modules/auth/services/mfaService';
import { useWorkspace } from '../context/workspaceContext';

type View =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'off' }
  | { kind: 'enrolling'; enrollment: Enrollment }
  | { kind: 'on'; factorId: string; disabling: boolean };

const GHOST =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-bold text-rz-muted ring-1 ring-rz-line hover:bg-rz-canvas disabled:opacity-50';
const PRIMARY =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[14px] font-bold text-white disabled:opacity-50';

/** Definições: ligar ou desligar a confirmação em dois passos (código da app de autenticação). */
export const TwoFactorCard: React.FC = () => {
  const { isPreview } = useWorkspace();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setView({ kind: 'loading' });
    try {
      const { active } = await mfaService.status();
      setView(active ? { kind: 'on', factorId: active.id, disabling: false } : { kind: 'off' });
    } catch {
      setView({ kind: 'error' });
    }
  };

  useEffect(() => {
    if (!isPreview) void load();
    else setView({ kind: 'off' });
  }, [isPreview]);

  const start = async () => {
    if (isPreview) return void toast({ title: 'Pré-visualização: sem contas reais' });
    setBusy(true);
    try {
      setView({ kind: 'enrolling', enrollment: await mfaService.startEnrollment() });
    } catch (error) {
      toast({
        title: isMfaUnavailable(error)
          ? 'Ainda não está disponível'
          : 'Não foi possível começar a configuração',
        description: mfaErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (view.kind === 'enrolling') await mfaService.cancelEnrollment(view.enrollment.factorId);
    void load();
  };

  const confirmEnrollment = async (enrollment: Enrollment, code: string) => {
    try {
      await mfaService.verify(enrollment.factorId, code);
    } catch (error) {
      return mfaErrorMessage(error);
    }
    toast({ title: 'Confirmação em dois passos ativa' });
    setView({ kind: 'on', factorId: enrollment.factorId, disabling: false });
    return null;
  };

  const disable = async (factorId: string, code: string) => {
    try {
      // Desligar exige a sessão confirmada: o código da app prova que é a própria pessoa.
      await mfaService.verify(factorId, code);
      await mfaService.disable(factorId);
    } catch (error) {
      return mfaErrorMessage(error);
    }
    toast({ title: 'Confirmação em dois passos desativada' });
    setView({ kind: 'off' });
    return null;
  };

  const copySecret = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-[16px] font-bold">
            Confirmação em dois passos
            {view.kind === 'on' && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[12px] font-bold text-emerald-800">
                Ativa
              </span>
            )}
          </h2>
          <p className="text-[13px] text-rz-muted">
            Além da palavra-passe, a entrada pede um código de 6 dígitos de uma app de autenticação
            (Google Authenticator, Microsoft Authenticator, Authy…). Recomendado para quem
            administra.
          </p>
        </div>
      </div>

      {view.kind === 'loading' && (
        <div className="mt-4 flex justify-center" role="status" aria-label="A carregar">
          <Loader2 className="h-5 w-5 animate-spin text-rz-primary" />
        </div>
      )}

      {view.kind === 'error' && (
        <div className="mt-4 space-y-3">
          <p role="alert" className="text-[13px] font-semibold text-rose-600">
            Não foi possível ver o estado. Verifique a ligação.
          </p>
          <button type="button" onClick={() => void load()} className={GHOST}>
            Tentar outra vez
          </button>
        </div>
      )}

      {view.kind === 'off' && (
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy}
          className={`${PRIMARY} mt-4`}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Ativar
        </button>
      )}

      {view.kind === 'enrolling' && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-[14px] font-bold">1. Leia o código QR com a app</p>
            <img
              src={qrSource(view.enrollment.qrCode)}
              alt="Código QR para configurar a app de autenticação"
              className="mx-auto mt-2 h-44 w-44 rounded-2xl bg-white p-2 ring-1 ring-rz-line"
            />
            <p className="mt-2 text-[12.5px] text-rz-muted">
              Não consegue ler? Introduza esta chave na app:
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-xl bg-rz-canvas px-3 py-2 text-[13px] font-semibold tracking-wide">
                {groupSecret(view.enrollment.secret)}
              </code>
              <button
                type="button"
                onClick={() => void copySecret(view.enrollment.secret)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rz-muted ring-1 ring-rz-line hover:bg-rz-canvas"
                aria-label="Copiar a chave"
                title="Copiar a chave"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-[12.5px] text-rz-muted">
              Guarde esta chave num sítio seguro. Se perder o telemóvel, a equipa da Realize tem de
              repor a confirmação da sua conta.
            </p>
          </div>
          <div>
            <p className="mb-2 text-[14px] font-bold">2. Introduza o código que a app mostra</p>
            <MfaCodeForm
              submitLabel="Confirmar e ativar"
              onSubmit={code => confirmEnrollment(view.enrollment, code)}
              autoFocus={false}
            >
              <button type="button" onClick={() => void cancel()} className={GHOST}>
                Cancelar
              </button>
            </MfaCodeForm>
          </div>
        </div>
      )}

      {view.kind === 'on' && !view.disabling && (
        <div className="mt-4 space-y-3">
          <p className="text-[13px] text-rz-muted">
            A cada entrada é pedido o código da app, depois da palavra-passe. Se perder o telemóvel,
            a equipa da Realize tem de repor a confirmação da sua conta.
          </p>
          <button
            type="button"
            onClick={() => setView({ ...view, disabling: true })}
            className={`${GHOST} w-full`}
          >
            Desativar
          </button>
        </div>
      )}

      {view.kind === 'on' && view.disabling && (
        <div className="mt-4 space-y-2">
          <p className="text-[14px] font-bold">Introduza o código da app para desativar</p>
          <MfaCodeForm
            tone="danger"
            submitLabel="Desativar"
            onSubmit={code => disable(view.factorId, code)}
          >
            <button
              type="button"
              onClick={() => setView({ ...view, disabling: false })}
              className={GHOST}
            >
              Cancelar
            </button>
          </MfaCodeForm>
        </div>
      )}
    </section>
  );
};
