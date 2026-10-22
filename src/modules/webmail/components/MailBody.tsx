import React, { useEffect, useRef, useState } from 'react';
import { readerDocument } from '../lib/mailFormat';
import type { MailAttachmentInfo, MailMessage } from '../types';
import { AttachmentThumb } from './AttachmentThumb';

interface MailBodyProps {
  message: MailMessage;
  onDownload: (message: MailMessage, attachmentId: string) => void;
  onOpenAttachment: (message: MailMessage, attachment: MailAttachmentInfo) => void;
}

/** Corpo do email isolado num iframe (sem scripts) e os anexos em miniatura. */
export const MailBody: React.FC<MailBodyProps> = ({ message, onDownload, onOpenAttachment }) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(320);
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
  const onFrameLoad = () => {
    fit();
    const doc = frame.current?.contentDocument;
    doc?.querySelectorAll('img').forEach(img => img.addEventListener('load', fit, { once: true }));
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
      <iframe
        ref={frame}
        title="Conteúdo do email"
        // Sem allow-scripts: o HTML do email nunca corre código.
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={readerDocument(message)}
        onLoad={onFrameLoad}
        style={{ height }}
        className="mt-5 w-full border-0"
      />
      {message.attachments.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
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
    </>
  );
};
