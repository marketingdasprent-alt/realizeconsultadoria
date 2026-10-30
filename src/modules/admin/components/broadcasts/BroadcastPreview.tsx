import React from 'react';
import { Paperclip } from 'lucide-react';
import type { BroadcastDraft } from '../../lib/broadcast';
import type { BroadcastAttachment } from '../../services/broadcastService';
import { signatureToHtml } from '@/modules/webmail/lib/signature';

const URL_PATTERN = /(https?:\/\/[^\s]+[^\s.,;:!?)])/g;

/** Um parágrafo com as ligações a dourado (como no email). */
const Paragraph: React.FC<{ text: string }> = ({ text }) => (
  <p className="mb-3 whitespace-pre-line leading-relaxed">
    {text.split(URL_PATTERN).map((part, index) =>
      index % 2 === 1 ? (
        <span key={index} className="text-[#B7933D] underline">
          {part}
        </span>
      ) : (
        <React.Fragment key={index}>{part}</React.Fragment>
      )
    )}
  </p>
);

/** Como o email vai chegar (o mesmo desenho que a função envia). */
export const BroadcastPreview: React.FC<{
  draft: BroadcastDraft;
  attachments: BroadcastAttachment[];
  /** Assinatura de email escolhida (no lugar do nome, como no email). */
  signatureHtml?: string | null;
}> = ({ draft, attachments, signatureHtml }) => {
  const signature = signatureToHtml(signatureHtml ?? null);
  const paragraphs = draft.message
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean);
  return (
    <div className="overflow-hidden rounded-[22px] bg-[#f4f2ee] p-3 sm:p-4">
      <div className="overflow-hidden rounded-2xl bg-white shadow-rz-soft">
        <div className="bg-[#111111] px-6 py-4">
          <span className="block text-[17px] font-bold tracking-[2px] text-[#B7933D]">REALIZE</span>
          <span className="block text-[10px] tracking-[3px] text-[#B7933D]">CONSULTADORIA</span>
        </div>
        <div className="space-y-1 px-6 pb-2 pt-5 text-[14px] text-[#1f1d2b]">
          <h2 className="mb-3 text-[18px] font-bold text-[#111111]">
            {draft.subject.trim() || 'Assunto do comunicado'}
          </h2>
          {paragraphs.length ? (
            paragraphs.map((text, index) => <Paragraph key={index} text={text} />)
          ) : (
            <p className="text-rz-muted">A mensagem aparece aqui enquanto escreve.</p>
          )}
          {signature ? (
            // Já limpa (sem scripts nem eventos): é a assinatura da própria pessoa.
            <div
              className="pb-4 pt-1 text-[13px] [&_img]:inline-block [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: signature }}
            />
          ) : (
            <p className="pb-4 pt-1 text-[13px] text-[#555555]">{draft.senderName}</p>
          )}
        </div>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-[#eee] px-6 py-3">
            {attachments.map(file => (
              <span
                key={file.path}
                className="inline-flex items-center gap-1 rounded-full bg-[#f4f2ee] px-2.5 py-1 text-[12px]"
              >
                <Paperclip className="h-3 w-3" /> {file.name}
              </span>
            ))}
          </div>
        )}
        <div className="bg-[#faf8f4] px-6 py-3 text-[11px] text-[#8a8597]">
          Comunicado interno da Realize Consultadoria · {new Date().getFullYear()}
        </div>
      </div>
      <p className="mt-2 px-1 text-[11.5px] text-rz-muted">
        Sai de marketing@dasprent.pt, com o nome de quem assina.
      </p>
    </div>
  );
};
