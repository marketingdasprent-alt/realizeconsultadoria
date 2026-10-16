import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, Check, Clock, Upload, X } from 'lucide-react';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import {
  DOCUMENT_CATEGORIES,
  getDocumentCategoryLabel,
  type EmployeeDocument,
} from '@/lib/documents';
import { cn } from '@/lib/utils';
import { AdminUploadDocumentDialog } from '@/modules/documents/components/admin/AdminUploadDocumentDialog';
import { RejectDocumentDialog } from '@/modules/documents/components/admin/RejectDocumentDialog';
import { ReviewDocumentDialog } from '@/modules/documents/components/admin/ReviewDocumentDialog';
import { DocumentStatusBadge, ExpiryBadge } from '@/modules/documents/components/DocumentBadges';
import { useDocumentDownload } from '@/modules/documents/hooks/useDocumentDownload';
import { useEmployeeDocuments } from '@/modules/documents/hooks/useEmployeeDocuments';
import { useDocumentRemoval } from '../../hooks/useDocumentRemoval';
import {
  registrationHistory,
  slotStates,
  type RegistrationSlot,
} from '../../lib/registrationSlots';
import { FileRow, FileSection } from './files/FileRow';

interface EmployeeDocumentsTabProps {
  employeeId: string;
}

const detail = (doc: EmployeeDocument) =>
  [
    getDocumentCategoryLabel(doc.category),
    doc.document_number,
    doc.file_name,
    format(new Date(doc.created_at), 'dd/MM/yyyy'),
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * Documentos de identificação e registo: um cartão por documento (em falta, por aprovar ou
 * aprovado, com validade). O que o colaborador envia pela app aprova-se aqui.
 */
const EmployeeDocumentsTab = ({ employeeId }: EmployeeDocumentsTabProps) => {
  const { all, isLoading, refetch } = useEmployeeDocuments(employeeId);
  const { openingId, open } = useDocumentDownload();
  const removal = useDocumentRemoval(refetch);
  const [uploadFor, setUploadFor] = useState<RegistrationSlot | null>(null);
  const [reviewing, setReviewing] = useState<EmployeeDocument | null>(null);
  const [rejecting, setRejecting] = useState<EmployeeDocument | null>(null);

  const states = useMemo(() => slotStates(all), [all]);
  const history = useMemo(() => registrationHistory(all), [all]);
  const pending = states.flatMap(state => state.pending);

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map(key => (
          <div key={key} className="h-32 animate-pulse rounded-[24px] bg-white" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <FileSection
          title="Enviados pelo colaborador"
          description="Confirme o tipo, o número e a validade ao aprovar."
          count={pending.length}
        >
          <ul>
            {pending.map(doc => (
              <FileRow
                key={doc.id}
                title={getDocumentCategoryLabel(doc.category)}
                subtitle={detail(doc)}
                onOpen={() => open(doc)}
                isOpening={openingId === doc.id}
                actions={
                  <>
                    <button
                      type="button"
                      onClick={() => setRejecting(doc)}
                      className="flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" /> Rejeitar
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewing(doc)}
                      className="flex h-9 items-center gap-1 rounded-full bg-emerald-600 px-3 text-[13px] font-bold text-white hover:bg-emerald-700"
                    >
                      <Check className="h-4 w-4" /> Aprovar
                    </button>
                  </>
                }
              />
            ))}
          </ul>
        </FileSection>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {states.map(({ slot, current, pending: waiting }) => (
          <section
            key={slot.key}
            className={cn(
              'flex flex-col rounded-[24px] bg-white p-4 shadow-rz-soft ring-1',
              !current && slot.required ? 'ring-red-200' : 'ring-rz-line'
            )}
          >
            <header className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-extrabold">{slot.label}</h3>
                <p className="text-[12.5px] text-rz-muted">{slot.hint}</p>
              </div>
              {current ? (
                <ExpiryBadge expiryDate={current.expiry_date} />
              ) : waiting.length > 0 ? (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11.5px] font-bold text-amber-700">
                  <Clock className="h-3 w-3" /> Por aprovar
                </span>
              ) : (
                <span
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold',
                    slot.required ? 'bg-red-100 text-red-700' : 'bg-rz-canvas text-rz-muted'
                  )}
                >
                  {slot.required && <AlertCircle className="h-3 w-3" />} Em falta
                </span>
              )}
            </header>
            {current && (
              <ul className="mt-2">
                <FileRow
                  title={getDocumentCategoryLabel(current.category)}
                  subtitle={[current.document_number, current.file_name]
                    .filter(Boolean)
                    .join(' · ')}
                  onOpen={() => open(current)}
                  isOpening={openingId === current.id}
                  onDelete={() => removal.ask(current)}
                />
              </ul>
            )}
            {current && waiting.length > 0 && (
              <p className="mt-1 px-2.5 text-[12.5px] font-semibold text-amber-700">
                O colaborador enviou um novo — aprove acima para o substituir.
              </p>
            )}
            <button
              type="button"
              onClick={() => setUploadFor(slot)}
              className="mt-auto flex items-center justify-center gap-2 rounded-full pt-3 text-[13px] font-semibold text-rz-primary hover:underline"
            >
              <Upload className="h-4 w-4" /> {current ? 'Substituir' : 'Carregar'}
            </button>
          </section>
        ))}
      </div>

      {history.length > 0 && (
        <FileSection
          title="Histórico"
          description="Substituídos e rejeitados."
          count={history.length}
        >
          <ul>
            {history.map(doc => (
              <FileRow
                key={doc.id}
                title={getDocumentCategoryLabel(doc.category)}
                subtitle={detail(doc)}
                badges={<DocumentStatusBadge status={doc.status} />}
                onOpen={() => open(doc)}
                isOpening={openingId === doc.id}
                onDelete={() => removal.ask(doc)}
                muted
              />
            ))}
          </ul>
        </FileSection>
      )}

      <AdminUploadDocumentDialog
        open={!!uploadFor}
        onOpenChange={value => !value && setUploadFor(null)}
        employeeId={employeeId}
        onUploaded={refetch}
        categories={DOCUMENT_CATEGORIES.filter(c => uploadFor?.categories.includes(c.value))}
        initialCategory={uploadFor?.categories.length === 1 ? uploadFor.categories[0] : undefined}
      />
      {reviewing && (
        <ReviewDocumentDialog
          doc={reviewing}
          onClose={() => setReviewing(null)}
          onReviewed={() => {
            setReviewing(null);
            refetch();
          }}
        />
      )}
      {rejecting && (
        <RejectDocumentDialog
          doc={rejecting}
          onClose={() => setRejecting(null)}
          onReviewed={() => {
            setRejecting(null);
            refetch();
          }}
        />
      )}
      <DeleteConfirmDialog
        open={!!removal.target}
        onOpenChange={value => !value && removal.cancel()}
        title="Apagar documento"
        description="O ficheiro deixa de estar disponível para o colaborador e para o admin."
        itemName={removal.target?.file_name}
        onConfirm={removal.confirm}
        isLoading={removal.isRemoving}
      />
    </div>
  );
};

export default EmployeeDocumentsTab;
