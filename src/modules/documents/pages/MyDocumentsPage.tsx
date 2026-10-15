import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, FileCheck2, Loader2, Receipt, Send, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getDocumentCategoryLabel, getExpiryInfo } from '@/lib/documents';
import { cn } from '@/lib/utils';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { CurrentDocumentsList } from '../components/employee/CurrentDocumentsList';
import { PayslipsList } from '../components/employee/PayslipsList';
import { SubmissionsList } from '../components/employee/SubmissionsList';
import { SubmitDocumentDialog } from '../components/employee/SubmitDocumentDialog';
import { useEmployeeDocuments } from '../hooks/useEmployeeDocuments';

type Tab = 'current' | 'payslips' | 'submissions';

/** Documentos (briefing §13): em vigor, recibos e os enviados, com os mesmos fluxos de aprovação. */
const MyDocumentsPage: React.FC = () => {
  const { user, isPreview } = useWorkspace();
  const docs = useEmployeeDocuments(isPreview ? null : user.employeeId);
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('current');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [presetCategory, setPresetCategory] = useState<string | null>(null);

  // Atalho "Enviar documento" (/colaborador/documentos?enviar=1&tipo=…)
  useEffect(() => {
    if (params.get('enviar')) {
      setPresetCategory(params.get('tipo'));
      setDialogOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const openSubmit = (category: string | null = null) => {
    if (isPreview)
      return toast({ title: 'Pré-visualização', description: 'Enviar usa dados reais.' });
    setPresetCategory(category);
    setDialogOpen(true);
  };

  const pending = docs.submissions.filter(s => s.status === 'pending').length;
  const expiring = docs.current.filter(d => {
    const state = getExpiryInfo(d.expiry_date).state;
    return state === 'expiring' || state === 'expired';
  });
  const tiles: {
    key: Tab;
    label: string;
    count: number;
    icon: React.ElementType;
    tint: string;
    hint?: string;
  }[] = [
    {
      key: 'current',
      label: 'Em vigor',
      count: docs.current.length,
      icon: FileCheck2,
      tint: 'from-amber-400 to-orange-500',
    },
    {
      key: 'payslips',
      label: 'Recibos',
      count: docs.payslips.length,
      icon: Receipt,
      tint: 'from-emerald-400 to-teal-600',
    },
    {
      key: 'submissions',
      label: 'Enviados',
      count: docs.submissions.length,
      icon: Send,
      tint: 'from-violet-500 to-indigo-600',
      hint: pending ? `${pending} a aguardar aprovação` : undefined,
    },
  ];
  const isLoading = !isPreview && docs.isLoading;

  return (
    <WorkspacePage>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-extrabold">Documentos</h1>
        <button
          type="button"
          onClick={() => openSubmit()}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-semibold text-white shadow-[0_12px_24px_-12px_hsl(var(--rz-primary))]"
        >
          <Upload className="h-4 w-4" /> Enviar documento
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map(tile => (
          <button
            key={tile.key}
            type="button"
            onClick={() => setTab(tile.key)}
            aria-pressed={tab === tile.key}
            className={cn(
              'relative overflow-hidden rounded-[26px] bg-gradient-to-br p-5 text-left text-white shadow-rz-soft transition-transform hover:-translate-y-0.5',
              tile.tint,
              tab === tile.key ? 'ring-4 ring-rz-primary/25' : 'opacity-90'
            )}
          >
            <tile.icon className="h-6 w-6 opacity-90" />
            <p className="mt-3 text-3xl font-extrabold">{tile.count}</p>
            <p className="text-sm font-semibold text-white/90">{tile.label}</p>
            {tile.hint && <p className="mt-1 text-xs font-bold text-white">{tile.hint}</p>}
          </button>
        ))}
      </div>

      {expiring.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {expiring.map(d => getDocumentCategoryLabel(d.category)).join(', ')}{' '}
          {expiring.length === 1 ? 'está' : 'estão'} a expirar ou expirado. Envie a versão
          atualizada.
        </p>
      )}

      <section className="mt-4 rounded-[28px] bg-white p-4 shadow-rz-soft ring-1 ring-rz-line md:p-6">
        {docs.error && <p className="mb-2 text-sm text-rose-600">{docs.error}</p>}
        {isLoading ? (
          <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-rz-primary" />
        ) : tab === 'current' ? (
          <CurrentDocumentsList
            documents={docs.current}
            archived={docs.archived}
            onUpdate={openSubmit}
          />
        ) : tab === 'payslips' ? (
          <PayslipsList payslips={docs.payslips} />
        ) : (
          <SubmissionsList submissions={docs.submissions} onChanged={docs.refetch} />
        )}
      </section>

      {!isPreview && (
        <SubmitDocumentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          employeeId={user.employeeId}
          employeeName={user.name}
          presetCategory={presetCategory}
          onSubmitted={docs.refetch}
        />
      )}
    </WorkspacePage>
  );
};

export default MyDocumentsPage;
