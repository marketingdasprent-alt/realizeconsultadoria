import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { composeWithSignature } from '../lib/signature';
import { mailService } from '../services/mailService';
import type { ComposeInput } from '../types';

/** Espera depois da última alteração antes de guardar no fornecedor. */
const AUTOSAVE_MS = 4000;

export type DraftStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SavedDraftRef {
  id: string;
  accountId: string;
}

interface DraftSaverOptions {
  /** Há um compositor aberto. */
  open: boolean;
  /** Muda sempre que algo muda no email (texto, destinatários, anexos, caixa, assinatura). */
  snapshot: string;
  /** Há algo que valha a pena guardar (texto, assunto, destinatários ou anexos). */
  hasContent: boolean;
  /** Rascunho já guardado com que o compositor abriu (aberto da pasta Rascunhos). */
  initial: SavedDraftRef | null;
  build: () => Promise<ComposeInput>;
}

/**
 * Guarda o rascunho na pasta Rascunhos do fornecedor: sozinho, alguns segundos depois de cada
 * alteração, e na hora com `flush` (ao fechar ou minimizar) ou com o botão.
 */
export const useDraftSaver = ({
  open,
  snapshot,
  hasContent,
  initial,
  build,
}: DraftSaverOptions) => {
  const { isPreview } = useWorkspace();
  const qc = useQueryClient();
  const [status, setStatus] = useState<DraftStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saved = useRef<SavedDraftRef | null>(initial);
  const savedSnapshot = useRef(snapshot);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef<Promise<boolean> | null>(null);
  // Sempre a versão atual (sem refazer o temporizador a cada render).
  const buildRef = useRef(build);
  buildRef.current = build;

  // Cada compositor novo começa do zero (ou do rascunho com que abriu).
  useEffect(() => {
    saved.current = initial;
    savedSnapshot.current = snapshot;
    setStatus('idle');
    setSavedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir outro rascunho
  }, [open, initial?.id]);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const save = useCallback(async (): Promise<boolean> => {
    cancel();
    if (isPreview || !hasContent) return true;
    if (snapshot === savedSnapshot.current && saved.current) return true;
    // Um de cada vez: se já está a guardar, espera e volta a ver.
    if (running.current) await running.current;
    const job = (async () => {
      setStatus('saving');
      const input = await buildRef.current();
      const composed = composeWithSignature(
        input.text,
        input.signatureHtml ?? null,
        input.quotedHtml ?? null
      );
      // Mudou de caixa: o rascunho antigo sai da outra caixa.
      const previous = saved.current;
      const sameAccount = previous?.accountId === input.accountId;
      if (previous && !sameAccount) void mailService.deleteDraft(previous.accountId, previous.id);
      const { data, error } = await mailService.saveDraft(
        { ...input, text: composed.text },
        composed.html,
        sameAccount ? (previous?.id ?? null) : null
      );
      if (error || !data) {
        setStatus('error');
        return false;
      }
      saved.current = data.id ? { id: data.id, accountId: input.accountId } : null;
      savedSnapshot.current = snapshot;
      setStatus('saved');
      setSavedAt(new Date());
      void qc.invalidateQueries({ queryKey: ['mail', 'list'] });
      return true;
    })();
    running.current = job;
    try {
      return await job;
    } finally {
      if (running.current === job) running.current = null;
    }
  }, [isPreview, hasContent, snapshot, qc]);

  // Guarda sozinho alguns segundos depois da última alteração.
  useEffect(() => {
    if (!open || isPreview || !hasContent || snapshot === savedSnapshot.current) return;
    cancel();
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
    return cancel;
  }, [open, isPreview, hasContent, snapshot, save]);

  return {
    status,
    savedAt,
    /** Rascunho guardado (para o apagar depois de enviar). */
    current: () => saved.current,
    /** Guarda já, se houver alterações por guardar. */
    flush: save,
    /** Deixa de guardar (enviado ou descartado). */
    stop: cancel,
    /** Descarta: apaga o rascunho guardado. */
    discard: async () => {
      cancel();
      const draft = saved.current;
      saved.current = null;
      if (draft && !isPreview) {
        await mailService.deleteDraft(draft.accountId, draft.id);
        void qc.invalidateQueries({ queryKey: ['mail', 'list'] });
      }
    },
  };
};
