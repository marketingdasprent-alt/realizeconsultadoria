import { useCallback, useRef, useState } from 'react';
import { getBestPosition, getDeviceId, type PositionPayload } from '@/lib/geolocation';
import type { TagPayload } from '@/lib/nfc';
import { getErrorMessage, getPunchMessage, type PunchMethod } from '@/lib/timeclock';
import { timeClockService, type PunchResponse } from '../services/timeClockService';

export type PunchPhase = 'idle' | 'locating' | 'sending' | 'success' | 'error';

export interface PunchOutcome {
  ok: boolean;
  code: string;
  message: string;
  entry?: PunchResponse['entry'];
  /** Fora do local: o colaborador pode pedir para registar como trabalho remoto. */
  canRequestRemote?: boolean;
  distanceM?: number | null;
  locationName?: string | null;
}

interface UsePunchResult {
  phase: PunchPhase;
  outcome: PunchOutcome | null;
  isBusy: boolean;
  /** Obtém a localização e envia o registo; Entrada/Saída é decidido no servidor. */
  punch: (method: PunchMethod, tag?: TagPayload) => Promise<PunchOutcome | null>;
  /** Repete o último registo recusado como trabalho remoto (fica a aguardar aprovação). */
  requestRemote: (note: string) => Promise<PunchOutcome | null>;
  /** Troca Entrada↔Saída do registo acabado de fazer (até 3 minutos). */
  swap: () => Promise<string | null>;
  reset: () => void;
}

interface LastRequest {
  method: PunchMethod;
  tag?: TagPayload;
  position: PositionPayload;
  capturedAt: number;
}

/** Reutiliza a leitura GPS no pedido remoto se ainda estiver fresca (servidor aceita até 2 min). */
const REUSE_POSITION_MS = 90 * 1000;

const NETWORK_ERROR: PunchOutcome = {
  ok: false,
  code: 'network',
  message: 'Sem ligação ao servidor. Verifique a internet e tente novamente.',
};

export const usePunch = (): UsePunchResult => {
  const [phase, setPhase] = useState<PunchPhase>('idle');
  const [outcome, setOutcome] = useState<PunchOutcome | null>(null);
  const inFlight = useRef(false);
  const lastRequest = useRef<LastRequest | null>(null);

  const finish = (result: PunchOutcome): PunchOutcome => {
    setOutcome(result);
    setPhase(result.ok ? 'success' : 'error');
    return result;
  };

  const send = useCallback(
    async (
      method: PunchMethod,
      tag: TagPayload | undefined,
      reuse: LastRequest | null,
      remote?: { note: string }
    ): Promise<PunchOutcome | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setOutcome(null);
      try {
        const ageOf = (r: LastRequest) => r.position.age_ms + Date.now() - r.capturedAt;
        let base: LastRequest;
        if (reuse && ageOf(reuse) < REUSE_POSITION_MS) {
          base = reuse;
        } else {
          setPhase('locating');
          try {
            base = { method, tag, position: await getBestPosition(), capturedAt: Date.now() };
          } catch (error: unknown) {
            return finish({
              ok: false,
              code: 'missing_position',
              message: getErrorMessage(error, getPunchMessage('missing_position')),
            });
          }
        }
        lastRequest.current = base;
        const position = { ...base.position, age_ms: ageOf(base) };

        setPhase('sending');
        const { data, error } = await timeClockService.punch({
          method,
          tag,
          position,
          device_id: getDeviceId(),
          ...(remote ? { remote: true, note: remote.note.trim() || undefined } : {}),
        });
        if (error || !data) return finish(NETWORK_ERROR);
        return finish({
          ok: data.ok,
          code: data.code,
          message: getPunchMessage(data.code),
          entry: data.entry,
          canRequestRemote: data.can_request_remote === true,
          distanceM: data.distance_m ?? null,
          locationName: data.location_name ?? null,
        });
      } finally {
        inFlight.current = false;
      }
    },
    []
  );

  const punch = useCallback(
    (method: PunchMethod, tag?: TagPayload) => send(method, tag, null),
    [send]
  );

  const requestRemote = useCallback(
    async (note: string) => {
      const last = lastRequest.current;
      if (!last) return null;
      return send(last.method, last.tag, last, { note });
    },
    [send]
  );

  const swap = useCallback(async (): Promise<string | null> => {
    const entry = outcome?.entry;
    if (!entry) return 'Sem registo para trocar.';
    const { data, error } = await timeClockService.swapOwnEntry(entry.id);
    if (error || !data) return getErrorMessage(error, 'Não foi possível trocar o registo.');
    setOutcome(current =>
      current?.entry?.id === entry.id
        ? { ...current, entry: { ...current.entry, entry_type: data } }
        : current
    );
    return null;
  }, [outcome]);

  const reset = useCallback(() => {
    setPhase('idle');
    setOutcome(null);
    lastRequest.current = null;
  }, []);

  return {
    phase,
    outcome,
    isBusy: phase === 'locating' || phase === 'sending',
    punch,
    requestRemote,
    swap,
    reset,
  };
};
