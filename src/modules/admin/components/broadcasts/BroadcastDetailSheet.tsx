import React from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { AlertTriangle, Mail, Smartphone } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useBroadcastReads } from '../../hooks/useBroadcastReads';
import type { BroadcastEmployee } from '../../lib/broadcast';
import type { BroadcastHistoryRow } from '../../services/broadcastService';
import { BroadcastConfirmations } from './BroadcastConfirmations';

interface BroadcastDetailSheetProps {
  row: BroadcastHistoryRow | null;
  people: BroadcastEmployee[];
  canRemind: boolean;
  onClose: () => void;
}

const Stat: React.FC<{ icon: typeof Mail; label: string; value: string; tone?: string }> = ({
  icon: Icon,
  label,
  value,
  tone = 'text-rz-ink',
}) => (
  <div className="rounded-2xl bg-rz-canvas px-3 py-2.5">
    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-rz-muted">
      <Icon className="h-3.5 w-3.5" /> {label}
    </p>
    <p className={`mt-0.5 text-[16px] font-extrabold ${tone}`}>{value}</p>
  </div>
);

/** Um comunicado enviado: o texto, as entregas por email e as confirmações na app. */
export const BroadcastDetailSheet: React.FC<BroadcastDetailSheetProps> = ({
  row,
  people,
  canRemind,
  onClose,
}) => {
  const reads = useBroadcastReads(row, people);
  const failed = row?.failed_emails ?? [];

  return (
    <Sheet open={!!row} onOpenChange={open => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 font-jakarta sm:max-w-2xl">
        {row && (
          <>
            <SheetHeader className="border-b border-rz-line p-5 text-left">
              <p className="text-[12.5px] text-rz-muted">
                {format(parseISO(row.created_at), "d 'de' MMMM 'às' HH:mm", { locale: pt })}
                {row.audience_label ? ` · ${row.audience_label}` : ''}
              </p>
              <SheetTitle className="text-[20px] font-extrabold">{row.subject}</SheetTitle>
            </SheetHeader>
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat
                  icon={Mail}
                  label="Emails entregues"
                  value={`${row.recipients_count}${row.requested_count ? ` de ${row.requested_count}` : ''}`}
                />
                <Stat
                  icon={AlertTriangle}
                  label="Falharam"
                  value={String(failed.length)}
                  tone={failed.length ? 'text-rose-600' : 'text-rz-ink'}
                />
                <Stat
                  icon={Smartphone}
                  label="Na app"
                  value={row.published_in_app ? 'Sim' : 'Não'}
                />
              </div>
              {failed.length > 0 && (
                <p className="rounded-2xl bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
                  Não chegou a: {failed.join(', ')}
                </p>
              )}

              {row.published_in_app ? (
                <BroadcastConfirmations
                  confirmations={reads.confirmations}
                  reach={reads.reach}
                  isLoading={reads.isLoading}
                  reminding={reads.reminding}
                  canRemind={canRemind}
                  onRemind={() => void reads.remind()}
                />
              ) : (
                <p className="rounded-2xl bg-rz-canvas px-4 py-3 text-[13px] text-rz-muted">
                  Este comunicado foi só por email: não há confirmações de leitura.
                </p>
              )}

              <section className="space-y-1.5">
                <h3 className="text-[13px] font-bold text-rz-muted">Mensagem · {row.sender}</h3>
                <p className="whitespace-pre-wrap rounded-2xl bg-rz-canvas p-4 text-[14px] leading-relaxed">
                  {row.message}
                </p>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
