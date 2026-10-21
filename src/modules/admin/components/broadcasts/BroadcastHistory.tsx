import React from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { AlertTriangle, Mail, Smartphone } from 'lucide-react';
import type { BroadcastHistoryRow } from '../../services/broadcastService';

interface BroadcastHistoryProps {
  rows: BroadcastHistoryRow[];
  isLoading: boolean;
}

/** Comunicados enviados: quando, o quê, para quem, quantos saíram e se foram para a app. */
export const BroadcastHistory: React.FC<BroadcastHistoryProps> = ({ rows, isLoading }) => (
  <section className="overflow-hidden rounded-[28px] bg-white shadow-rz-soft ring-1 ring-rz-line">
    <header className="border-b border-rz-line px-5 py-4">
      <h2 className="text-[16px] font-extrabold">Enviados</h2>
    </header>
    {isLoading ? (
      <div className="space-y-2 p-4">
        {[0, 1, 2].map(key => (
          <div key={key} className="h-12 animate-pulse rounded-xl bg-rz-canvas" />
        ))}
      </div>
    ) : rows.length === 0 ? (
      <p className="px-6 py-10 text-center text-[14px] text-rz-muted">Ainda sem comunicados.</p>
    ) : (
      <ul className="divide-y divide-rz-line">
        {rows.map(row => {
          const failed = row.failed_emails?.length ?? 0;
          return (
            <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
              <span className="w-[92px] shrink-0 text-[12.5px] text-rz-muted">
                {format(parseISO(row.created_at), 'd MMM, HH:mm', { locale: pt })}
              </span>
              <span className="min-w-0 flex-1 basis-56">
                <span className="block truncate text-[14px] font-semibold" title={row.subject}>
                  {row.subject}
                </span>
                <span className="block truncate text-[12.5px] text-rz-muted">
                  {[row.audience_label, row.sender].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[12.5px] font-semibold">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700">
                  <Mail className="h-3.5 w-3.5" /> {row.recipients_count}
                  {row.requested_count ? ` de ${row.requested_count}` : ''}
                </span>
                {failed > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-rose-700"
                    title={row.failed_emails.join(', ')}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> {failed} falharam
                  </span>
                )}
                {row.published_in_app && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rz-primary-soft px-2.5 py-0.5 text-rz-primary">
                    <Smartphone className="h-3.5 w-3.5" /> App
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);
