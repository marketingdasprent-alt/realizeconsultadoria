import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { readerDocument } from '../lib/mailFormat';
import {
  conversationCandidates,
  insertAttachmentBar,
  loadMessage,
  matchHeader,
  visibleAttachments,
} from '../lib/quotedAttachments';
import { findQuotedHeaders } from '../lib/quotedHeaders';
import type { MailAttachmentInfo, MailMessage } from '../types';
import { AttachmentThumb } from './AttachmentThumb';

interface MailBodyProps {
  message: MailMessage;
  onDownload: (message: MailMessage, attachmentId: string) => void;
  onOpenAttachment: (message: MailMessage, attachment: MailAttachmentInfo) => void;
}

/** Os anexos em miniatura no topo (como no Gmail) e, por baixo, o corpo do email isolado num iframe (sem scripts). */
export const MailBody: React.FC<MailBodyProps> = ({ message, onDownload, onOpenAttachment }) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(320);
  const qc = useQueryClient();
  const { isPreview } = useWorkspace();
  // Cada abertura do email tem o seu número: o que chega tarde de uma abertura antiga não entra.
  const loadRun = useRef(0);
  // A altura acompanha o conteúdo (imagens que chegam depois, coluna mais estreita) e os emails
  // mais largos do que a coluna (ex.: tabelas de 600 px) encolhem para caber, sem barras.
  const fit = () => {
    const iframe = frame.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc?.body) return;
    const body = doc.body as HTMLElement & { style: CSSStyleDeclaration & { zoom: string } };
    body.style.zoom = '1';
    const available = iframe.clientWidth;
    const wide = doc.documentElement.scrollWidth;
    body.style.zoom = String(wide > available + 2 ? Math.max(0.45, available / wide) : 1);
    setHeight(Math.max(120, Math.ceil(doc.documentElement.scrollHeight) + 8));
  };
  /**
   * Histórico citado: no início de cada email citado, os anexos que esse email trouxe (procura-o
   * na caixa pelo assunto, remetente e data). Sem correspondência certa, não mostra nada.
   */
  const showQuotedAttachments = async (doc: Document) => {
    const run = ++loadRun.current;
    const headers = findQuotedHeaders(doc);
    if (!headers.length || isPreview) return;
    try {
      const candidates = await conversationCandidates(qc, message);
      for (const header of headers) {
        const match = matchHeader(header, candidates, message.id);
        if (!match?.hasAttachments) continue;
        const full = await loadMessage(qc, match).catch(() => null);
        if (!full || run !== loadRun.current || frame.current?.contentDocument !== doc) return;
        insertAttachmentBar(header, full, visibleAttachments(full), attachment =>
          onOpenAttachment(full, attachment)
        );
        fit();
      }
    } catch {
      // Sem pesquisa (servidor ocupado, sem rede): o email lê-se na mesma, só sem as faixas.
    }
  };
  const onFrameLoad = () => {
    fit();
    const doc = frame.current?.contentDocument;
    doc?.querySelectorAll('img').forEach(img => img.addEventListener('load', fit, { once: true }));
    if (doc) void showQuotedAttachments(doc);
  };
  useEffect(() => {
    const iframe = frame.current;
    if (!iframe || typeof ResizeObserver === 'undefined') return;
    let last = iframe.clientWidth;
    const observer = new ResizeObserver(() => {
      if (iframe.clientWidth === last) return;
      last = iframe.clientWidth;
      fit();
    });
    observer.observe(iframe);
    return () => observer.disconnect();
  }, [message]);

  return (
    <>
      {message.attachments.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Anexos">
          {message.attachments.map((attachment, index) => (
            <li key={attachment.id}>
              <AttachmentThumb
                accountId={message.accountId}
                messageId={message.id}
                attachment={attachment}
                withPreview={index < 6}
                onOpen={() => onOpenAttachment(message, attachment)}
                onDownload={() => onDownload(message, attachment.id)}
              />
            </li>
          ))}
        </ul>
      )}
      <iframe
        ref={frame}
        title="Conteúdo do email"
        // Sem allow-scripts: o HTML do email nunca corre código.
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={readerDocument(message)}
        onLoad={onFrameLoad}
        style={{ height }}
        className={`rz-keep-light w-full rounded-xl border-0 bg-white ${message.attachments.length > 0 ? 'mt-4' : 'mt-5'}`}
      />
    </>
  );
};
