import React, { useState } from 'react';
import { Loader2, Send, TestTube2 } from 'lucide-react';
import type { useBroadcasts } from '../../hooks/useBroadcasts';
import { AudiencePicker } from './AudiencePicker';
import { BroadcastFields } from './BroadcastFields';
import { BroadcastPreview } from './BroadcastPreview';
import { SendBroadcastDialog } from './SendBroadcastDialog';

const CARD = 'space-y-4 rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line sm:p-6';

interface BroadcastComposeTabProps {
  bc: ReturnType<typeof useBroadcasts>;
  companies: { id: string; name: string }[];
  canSend: boolean;
  loadingPermissions: boolean;
  /** Depois de enviar (abre os Enviados). */
  onSent: () => void;
}

/** Comunicados → Novo: para quem, a mensagem, a pré-visualização, o teste e o envio. */
export const BroadcastComposeTab: React.FC<BroadcastComposeTabProps> = ({
  bc,
  companies,
  canSend,
  loadingPermissions,
  onSent,
}) => {
  const [confirming, setConfirming] = useState(false);
  const reach = bc.recipients.length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <section className={CARD}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-extrabold">Para quem</h2>
            <p className="text-[13px] text-rz-muted">
              {bc.isLoading ? (
                'A carregar…'
              ) : (
                <>
                  <strong className="text-rz-ink">{reach}</strong> por email
                  {bc.missingEmail > 0 && ` · ${bc.missingEmail} sem email`}
                </>
              )}
            </p>
          </div>
          <AudiencePicker
            audience={bc.audience}
            onChange={bc.updateAudience}
            people={bc.people}
            companies={companies}
            error={bc.errors.audience}
          />
        </section>

        <section className={CARD}>
          <h2 className="text-[16px] font-extrabold">Mensagem</h2>
          <BroadcastFields
            draft={bc.draft}
            errors={bc.errors}
            onChange={bc.updateDraft}
            attachments={bc.attachments}
            uploading={bc.uploading}
            onAddFiles={files => void bc.addFiles(files)}
            onRemoveFile={bc.removeAttachment}
            publishInApp={bc.publishInApp}
            onPublishInApp={bc.setPublishInApp}
          />
        </section>
      </div>

      <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
        <BroadcastPreview draft={bc.draft} attachments={bc.attachments} />
        {!loadingPermissions && !canSend ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            Pode ver, mas não tem permissão para enviar comunicados.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => bc.check(true) && void bc.sendTest()}
              disabled={!!bc.busy || bc.uploading}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold ring-1 ring-rz-line hover:bg-rz-primary-soft disabled:opacity-60"
            >
              {bc.busy === 'test' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube2 className="h-4 w-4 text-rz-primary" />
              )}
              Enviar teste para mim
            </button>
            <button
              type="button"
              onClick={() => bc.check() && setConfirming(true)}
              disabled={!!bc.busy || bc.uploading || bc.isLoading}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-rz-primary px-5 text-[14px] font-bold text-white shadow-rz-soft hover:bg-rz-primary/90 disabled:opacity-60"
            >
              {bc.busy === 'send' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar a {reach} {reach === 1 ? 'pessoa' : 'pessoas'}
            </button>
          </div>
        )}
      </aside>

      <SendBroadcastDialog
        open={confirming}
        onOpenChange={setConfirming}
        subject={bc.draft.subject}
        emails={reach}
        appOnly={bc.missingEmail}
        publishInApp={bc.publishInApp}
        onConfirm={() => void bc.send().then(ok => ok && onSent())}
      />
    </div>
  );
};
