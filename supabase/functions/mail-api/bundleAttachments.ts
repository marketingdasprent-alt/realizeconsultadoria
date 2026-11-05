// Muitos anexos num só ficheiro: vários servidores de email recusam mensagens com mais de 100
// partes MIME ("550 Too many MIME parts: 121 > 100" do host-services.com). Acima de
// MAX_ATTACHMENT_PARTS anexos, vão todos num anexos.zip (sem compressão: rápido).

import { base64ToBytes, bytesToBase64 } from '../_shared/mail/mime.ts';
import type { OutgoingAttachment } from '../_shared/mail/types.ts';
import { buildZip } from '../_shared/mail/zip.ts';

/** Anexos soltos até aqui; acima, um zip (deixa folga para o texto, HTML e imagens). */
export const MAX_ATTACHMENT_PARTS = 90;

export const bundleIfTooMany = (
  attachments: OutgoingAttachment[],
  attachmentBytes: Uint8Array[]
): { attachments: OutgoingAttachment[]; attachmentBytes: Uint8Array[]; zipped: number } => {
  if (attachments.length <= MAX_ATTACHMENT_PARTS)
    return { attachments, attachmentBytes, zipped: 0 };
  const zip = buildZip(
    attachments.map((attachment, i) => ({
      name: attachment.filename,
      // Os anexos da caixa de origem vêm só em base64 (sem bytes)
      content: attachmentBytes[i]?.length ? attachmentBytes[i] : base64ToBytes(attachment.base64),
    }))
  );
  return {
    attachments: [{ filename: 'anexos.zip', mime: 'application/zip', base64: bytesToBase64(zip) }],
    attachmentBytes: [zip],
    zipped: attachments.length,
  };
};
