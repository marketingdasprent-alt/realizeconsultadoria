import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  audienceLabel,
  audienceOf,
  emptyAudience,
  recipientsOf,
  validateBroadcast,
  withoutEmail,
  type Audience,
  type BroadcastDraft,
  type BroadcastErrors,
} from '../lib/broadcast';
import { broadcastService, type BroadcastAttachment } from '../services/broadcastService';

const HISTORY_KEY = ['admin', 'broadcasts'];
// O comunicado a meio fica guardado neste browser: sair para o Workspace e voltar não o perde.
const DRAFT_KEY = 'rz.admin.broadcast.draft';

interface SavedBroadcast {
  draft: BroadcastDraft;
  audience: Audience;
  publishInApp: boolean;
  attachments: BroadcastAttachment[];
}

const readSaved = (): SavedBroadcast | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as SavedBroadcast) : null;
  } catch {
    return null;
  }
};

// Remetente antigo por omissão: rascunhos com ele passam a ter o nome de quem envia.
const OLD_DEFAULT_SENDER = 'Recursos Humanos · Realize Consultadoria';

const emptyDraft = (): BroadcastDraft => ({
  subject: '',
  message: '',
  senderName: '',
});

/** Pessoas → Comunicados: rascunho, a quem vai, anexos, teste e envio. */
export const useBroadcasts = (companies: { id: string; name: string }[]) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saved] = useState(readSaved);
  // A assinatura volta a ser escolhida (a predefinida) se tinha ficado "só o nome".
  const [draft, setDraft] = useState<BroadcastDraft>(() =>
    saved ? { ...saved.draft, signatureId: saved.draft.signatureId ?? undefined } : emptyDraft()
  );
  const [audience, setAudience] = useState<Audience>(() => saved?.audience ?? emptyAudience());
  const [publishInApp, setPublishInApp] = useState(saved?.publishInApp ?? true);
  const [attachments, setAttachments] = useState<BroadcastAttachment[]>(
    () => saved?.attachments ?? []
  );

  useEffect(() => {
    try {
      const empty = !draft.subject.trim() && !draft.message.trim() && !attachments.length;
      if (empty) localStorage.removeItem(DRAFT_KEY);
      else
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ draft, audience, publishInApp, attachments } satisfies SavedBroadcast)
        );
    } catch {
      // sem armazenamento (janela privada): fica só em memória
    }
  }, [draft, audience, publishInApp, attachments]);

  // Assina com a assinatura de email de quem envia (a predefinida), se tiver.
  const signatures = useQuery({
    queryKey: ['admin', 'broadcast-signatures'],
    queryFn: broadcastService.mySignatures,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (!signatures.data || draft.signatureId !== undefined) return;
    setDraft(current => ({ ...current, signatureId: signatures.data[0]?.id ?? null }));
  }, [signatures.data, draft.signatureId]);

  // Remetente por omissão: quem envia ("Thiago Sousa"), não um departamento.
  const senderName = useQuery({
    queryKey: ['admin', 'broadcast-sender-name'],
    queryFn: broadcastService.senderName,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (!senderName.data) return;
    setDraft(current =>
      // Vazio, o antigo "Recursos Humanos" ou só o nome (antes de haver departamento).
      !current.senderName.trim() ||
      current.senderName === OLD_DEFAULT_SENDER ||
      current.senderName === senderName.data.split(' · ')[0]
        ? { ...current, senderName: senderName.data }
        : current
    );
  }, [senderName.data, draft.senderName]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<BroadcastErrors>({});
  const [busy, setBusy] = useState<'test' | 'send' | null>(null);

  const employees = useQuery({
    queryKey: ['admin', 'broadcast-employees'],
    queryFn: broadcastService.employees,
    staleTime: 5 * 60_000,
  });
  const history = useQuery({ queryKey: HISTORY_KEY, queryFn: broadcastService.history });

  const people = useMemo(() => employees.data ?? [], [employees.data]);
  const recipients = useMemo(() => recipientsOf(people, audience), [people, audience]);
  const missingEmail = useMemo(() => withoutEmail(people, audience), [people, audience]);

  const updateDraft = (patch: Partial<BroadcastDraft>) => {
    setDraft(current => ({ ...current, ...patch }));
    setErrors(current => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof BroadcastDraft];
      return next;
    });
  };

  const updateAudience = (next: Audience) => {
    setAudience(next);
    setErrors(current => ({ ...current, audience: undefined }));
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const uploaded = await Promise.all([...files].map(broadcastService.uploadAttachment));
    setUploading(false);
    const ok = uploaded.filter((file): file is BroadcastAttachment => !!file);
    setAttachments(current => [...current, ...ok]);
    if (ok.length < files.length) toast({ title: 'Um anexo não carregou', variant: 'destructive' });
  };

  /** Valida antes de pedir confirmação (o teste só precisa do texto). */
  const check = (test = false) => {
    const reach = recipients.length + (publishInApp ? missingEmail : 0);
    const found = validateBroadcast(draft, test ? 1 : reach);
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const run = async (test: boolean) => {
    setBusy(test ? 'test' : 'send');
    const result = await broadcastService.send({
      draft,
      // Todos os escolhidos: o email vai a quem o tem; na app veem todos.
      employeeIds: audienceOf(people, audience).map(person => person.id),
      audience: { ...audience, label: audienceLabel(audience, companies) },
      publishInApp: test ? false : publishInApp,
      attachments,
      test,
    });
    setBusy(null);
    if (!result.ok) {
      toast({ title: result.error ?? 'Não foi possível enviar.', variant: 'destructive' });
      return false;
    }
    if (test) {
      toast({ title: 'Teste enviado', description: 'Veja a sua caixa de email.' });
      return true;
    }
    toast({
      title: `Enviado a ${result.sent} ${result.sent === 1 ? 'pessoa' : 'pessoas'}`,
      description: [
        result.failed.length ? `${result.failed.length} falharam.` : '',
        result.notices ? 'Publicado também na app.' : '',
      ]
        .filter(Boolean)
        .join(' '),
      variant: result.failed.length ? 'destructive' : undefined,
    });
    setDraft({ ...emptyDraft(), signatureId: draft.signatureId, senderName: draft.senderName });
    setAttachments([]);
    void queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
    return true;
  };

  return {
    draft,
    updateDraft,
    audience,
    updateAudience,
    publishInApp,
    setPublishInApp,
    attachments,
    removeAttachment: (path: string) =>
      setAttachments(current => current.filter(file => file.path !== path)),
    addFiles,
    uploading,
    errors,
    busy,
    signatures: signatures.data ?? [],
    people,
    isLoading: employees.isLoading,
    recipients,
    missingEmail,
    history: history.data ?? [],
    historyLoading: history.isLoading,
    check,
    sendTest: () => run(true),
    send: () => run(false),
  };
};
