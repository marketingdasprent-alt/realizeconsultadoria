import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, FileCheck2, Loader2, Receipt } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getDocumentCategoryLabel, getExpiryInfo } from '@/lib/documents';
import { cn } from '@/lib/utils';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { PayslipsList } from '../components/employee/PayslipsList';
import { RegistrationDocuments } from '../components/employee/RegistrationDocuments';
import { SubmitDocumentDialog } from '../components/employee/SubmitDocumentDialog';
import { useEmployeeDocuments } from '../hooks/useEmployeeDocuments';
import { buildRegistration, REGISTRATION_SLOTS, type RegistrationSlot } from '../lib/registration';

type Tab = 'personal' | 'payslips';

/**
 * Os meus documentos (nas Definições): documentos de registo (abrir e substituir; a
 * substituição fica à espera de aprovação no admin) e recibos de vencimento.
 */
const PersonalDocumentsPage: React.FC = () => {
  const { user, isPreview } = useWorkspace();
  const docs = useEmployeeDocuments(isPreview ? null : user.employeeId);
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'recibos' ? 'payslips' : 'personal');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [slot, setSlot] = useState<RegistrationSlot | null>(null);

  // Atalho "Enviar documento" (?enviar=1&tipo=…)
  useEffect(() => {
    if (params.get('enviar')) {
      const tipo = params.get('tipo') ?? '';
      setSlot(REGISTRATION_SLOTS.find(s => s.categories.includes(tipo)) ?? null);
      setDialogOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  // Enviar / substituir um documento de registo: o envio só deixa escolher os tipos desse lugar.
  const openSubmit = (next: RegistrationSlot) => {
    if (isPreview)
      return toast({ title: 'Pré-visualização', description: 'Enviar usa dados reais.' });
    setSlot(next);
    setDialogOpen(true);
  };

  const registration = buildRegistration(docs.all);
  const pending = registration.rows.filter(r => r.pendingReplacement).length;
  const expiring = registration.rows
    .map(r => r.doc)
    .filter(d => {
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
      key: 'personal',
      label: 'Documentos pessoais',
      count: registration.rows.length,
      icon: FileCheck2,
      tint: 'from-amber-400 to-orange-500',
      hint: pending ? `${pending} a aguardar aprovação` : undefined,
    },
    {
      key: 'payslips',
      label: 'Recibos',
      count: docs.payslips.length,
      icon: Receipt,
      tint: 'from-emerald-400 to-teal-600',
    },
  ];
  const isLoading = !isPreview && docs.isLoading;

  return (
    <WorkspacePage>
      <h1 className="mb-4 text-[26px] font-extrabold">Os meus documentos</h1>

      <div className="grid grid-cols-2 gap-3">
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
          {expiring.length === 1 ? 'está' : 'estão'} a expirar ou expirado. Use "Substituir" para
          enviar a versão atualizada.
        </p>
      )}

      <section className="mt-4 rounded-[28px] bg-white p-4 shadow-rz-soft ring-1 ring-rz-line md:p-6">
        {docs.error && <p className="mb-2 text-sm text-rose-600">{docs.error}</p>}
        {isLoading ? (
          <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-rz-primary" />
        ) : tab === 'personal' ? (
          <RegistrationDocuments documents={docs.all} onSubmit={openSubmit} />
        ) : (
          <PayslipsList payslips={docs.payslips} />
        )}
      </section>

      {!isPreview && (
        <SubmitDocumentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          employeeId={user.employeeId}
          employeeName={user.name}
          presetCategory={slot?.categories.length === 1 ? slot.categories[0] : null}
          categories={slot?.categories ?? null}
          onSubmitted={docs.refetch}
        />
      )}
    </WorkspacePage>
  );
};

export default PersonalDocumentsPage;
