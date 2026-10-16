import { useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { absenceTypeLabels } from '@/lib/absence-types';
import { Loader2, Paperclip, Share2 } from 'lucide-react';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import { Input } from '@/components/ui/input';
import {
  ADMIN_UPLOAD_CATEGORIES,
  formatFileSize,
  getDocumentCategoryLabel,
  PAYSLIP_CATEGORY,
} from '@/lib/documents';
import { AdminUploadDocumentDialog } from '@/modules/documents/components/admin/AdminUploadDocumentDialog';
import { useDocumentDownload } from '@/modules/documents/hooks/useDocumentDownload';
import { useEmployeeDocuments } from '@/modules/documents/hooks/useEmployeeDocuments';
import { REGISTRATION_CATEGORIES } from '@/modules/documents/lib/registration';
import { useDocumentRemoval } from '../../hooks/useDocumentRemoval';
import { useEmployeeAttachments } from '../../hooks/useEmployeeAttachments';
import { sharedDocuments } from '../../lib/registrationSlots';
import type { EmployeeAttachment } from '../../services/attachmentService';
import { FileRow, FileSection } from './files/FileRow';

interface EmployeeAttachmentsTabProps {
  employeeId: string;
}

// Partilháveis aqui: tudo o que não é de registo (Documentos) nem recibo (Recibos).
const SHARE_CATEGORIES = ADMIN_UPLOAD_CATEGORIES.filter(
  c => !REGISTRATION_CATEGORIES.includes(c.value) && c.value !== PAYSLIP_CATEGORY
);

const day = (iso: string) => format(new Date(iso), 'dd/MM/yyyy');

const short = (iso: string) => format(parseISO(iso), 'dd/MM/yyyy');

/** "12/10/2026" ou "12/10/2026 – 16/10/2026". */
const absencePeriod = (absence: { start_date: string; end_date: string }) =>
  absence.start_date === absence.end_date
    ? short(absence.start_date)
    : `${short(absence.start_date)} – ${short(absence.end_date)}`;

const STATUS: Record<string, { label: string; tone: string }> = {
  approved: { label: 'Aprovado', tone: 'bg-emerald-100 text-emerald-700' },
  partially_approved: { label: 'Aprovado em parte', tone: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'Pedido pendente', tone: 'bg-amber-100 text-amber-700' },
  rejected: { label: 'Pedido rejeitado', tone: 'bg-slate-100 text-slate-500' },
};

const AbsenceStatus = ({ status }: { status: string }) => {
  const info = STATUS[status] ?? { label: status, tone: 'bg-slate-100 text-slate-500' };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${info.tone}`}>
      {info.label}
    </span>
  );
};

/**
 * Anexos: o que não tem lugar nos outros separadores — documentos das ausências e baixas
 * (enviados pelo colaborador no pedido), documentos partilhados (comunicados, contrato…) e
 * outros ficheiros internos do admin.
 */
const EmployeeAttachmentsTab = ({ employeeId }: EmployeeAttachmentsTabProps) => {
  const files = useEmployeeAttachments(employeeId);
  const docs = useEmployeeDocuments(employeeId);
  const download = useDocumentDownload();
  const removal = useDocumentRemoval(docs.refetch);
  const [shareOpen, setShareOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [deleting, setDeleting] = useState<EmployeeAttachment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Ausências: os documentos dos pedidos (com o tipo e os dias) e, dos anexos antigos de
  // ausências, só os que não são cópia de um documento de pedido (ex.: baixas enviadas à parte).
  const absenceNames = new Set(files.absenceFiles.map(f => f.file_name));
  const absenceExtras = files.attachments.filter(
    a => a.source === 'absence' && !absenceNames.has(a.file_name)
  );
  const absenceCount = files.absenceFiles.length + absenceExtras.length;
  const internal = files.attachments.filter(a => a.source !== 'absence');
  const shared = useMemo(() => sharedDocuments(docs.all), [docs.all]);

  const attachmentRow = (attachment: EmployeeAttachment) => (
    <FileRow
      key={attachment.id}
      title={attachment.description || attachment.file_name}
      subtitle={[
        attachment.description ? attachment.file_name : null,
        formatFileSize(attachment.file_size),
        day(attachment.created_at),
      ]
        .filter(Boolean)
        .join(' · ')}
      onOpen={() => files.open(attachment)}
      isOpening={files.openingId === attachment.id}
      onDelete={() => setDeleting(attachment)}
    />
  );

  const upload = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (file && description.trim() && (await files.upload(file, description))) setDescription('');
  };

  const loading = files.isLoading || docs.isLoading;

  return (
    <div className="space-y-4">
      <FileSection
        title="Ausências e baixas"
        description="Documentos enviados pelo colaborador nos pedidos de ausência (baixas, justificações)."
        count={absenceCount}
      >
        {loading ? (
          <div className="h-14 animate-pulse rounded-2xl bg-rz-canvas" />
        ) : absenceCount === 0 ? (
          <p className="px-1 py-3 text-[13px] text-rz-muted">Sem documentos de ausências.</p>
        ) : (
          <ul>
            {files.absenceFiles.map(file => (
              <FileRow
                key={file.id}
                title={`${absenceTypeLabels[file.absence.type] ?? 'Ausência'} · ${absencePeriod(file.absence)}`}
                subtitle={`${file.file_name} · enviado a ${day(file.created_at)}`}
                badges={<AbsenceStatus status={file.absence.status} />}
                onOpen={() => files.open(file)}
                isOpening={files.openingId === file.id}
              />
            ))}
            {absenceExtras.map(attachmentRow)}
          </ul>
        )}
      </FileSection>

      <FileSection
        title="Partilhados com o colaborador"
        description="Comunicados, contrato e outros documentos que o colaborador vê na app."
        count={shared.length}
        action={
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-rz-primary px-4 text-[13px] font-bold text-white"
          >
            <Share2 className="h-4 w-4" /> Partilhar
          </button>
        }
      >
        {loading ? (
          <div className="h-14 animate-pulse rounded-2xl bg-rz-canvas" />
        ) : shared.length === 0 ? (
          <p className="px-1 py-3 text-[13px] text-rz-muted">Nada partilhado.</p>
        ) : (
          <ul>
            {shared.map(doc => (
              <FileRow
                key={doc.id}
                title={getDocumentCategoryLabel(doc.category)}
                subtitle={[doc.file_name, day(doc.created_at)].join(' · ')}
                onOpen={() => download.open(doc)}
                isOpening={download.openingId === doc.id}
                onDelete={() => removal.ask(doc)}
              />
            ))}
          </ul>
        )}
      </FileSection>

      <FileSection
        title="Outros anexos"
        description="Ficheiros internos: só os administradores os veem."
        count={internal.length}
      >
        <div className="mb-2 flex flex-col gap-2 sm:flex-row">
          <Input
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="Título do documento (ex.: Declaração de IRS 2025)"
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={files.isUploading || !description.trim()}
            title={description.trim() ? undefined : 'Escreva primeiro o título do documento'}
            className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold ring-1 ring-rz-line hover:bg-rz-canvas"
          >
            {files.isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
            Carregar anexo
          </button>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={event => upload(event.target.files?.[0])}
          />
        </div>
        {!loading && internal.length > 0 && <ul>{internal.map(attachmentRow)}</ul>}
      </FileSection>

      <AdminUploadDocumentDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        employeeId={employeeId}
        onUploaded={docs.refetch}
        categories={SHARE_CATEGORIES}
      />
      <DeleteConfirmDialog
        open={!!deleting}
        onOpenChange={value => !value && setDeleting(null)}
        title="Apagar anexo"
        description="O ficheiro é apagado definitivamente."
        itemName={deleting?.file_name}
        onConfirm={async () => {
          if (!deleting) return;
          setIsDeleting(true);
          if (await files.remove(deleting)) setDeleting(null);
          setIsDeleting(false);
        }}
        isLoading={isDeleting}
      />
      <DeleteConfirmDialog
        open={!!removal.target}
        onOpenChange={value => !value && removal.cancel()}
        title="Apagar documento"
        description="O colaborador deixa de o ver na app."
        itemName={removal.target?.file_name}
        onConfirm={removal.confirm}
        isLoading={removal.isRemoving}
      />
    </div>
  );
};

export default EmployeeAttachmentsTab;
