import { useCallback, useRef, useState } from 'react';
import { getBestPosition, getDeviceId, type PositionPayload } from '@/lib/geolocation';
import type { TagPayload } from '@/lib/nfc';
import {
  getErrorMessage,
  getPunchMessage,
  type EntryType,
  type PunchMethod,
} from '@/lib/timeclock';
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

/** O que o colaborador escolheu no formulário "Registar Ponto". */
export interface PunchChoice {
  entryType: EntryType;
  note?: string;
}

interface UsePunchResult {
  phase: PunchPhase;
  outcome: PunchOutcome | null;
  isBusy: boolean;
  /** Observação do último pedido (reaproveitada se for preciso registar como remoto). */
  lastNote: string;
  /** Obtém a localização e envia o registo com o tipo e a observação escolhidos. */
  punch: (
    method: PunchMethod,
    choice: PunchChoice,
    tag?: TagPayload
  ) => Promise<PunchOutcome | null>;
  /** Começa já a obter o GPS (enquanto o colaborador preenche), para o registo ser rápido. */
  warmUp: () => void;
  /** Repete o último registo recusado como trabalho remoto (fica a aguardar aprovação). */
  requestRemote: (note: string) => Promise<PunchOutcome | null>;
  /** Troca Entrada↔Saída do registo acabado de fazer (até 3 minutos). */
  swap: () => Promise<string | null>;
  reset: () => void;
}

interface Reading {
  position: PositionPayload;
  capturedAt: number;
}

interface LastRequest extends Reading {
  method: PunchMethod;
  choice: PunchChoice;
  tag?: TagPayload;
}

/** O servidor aceita leituras até 2 min; reutiliza-se até 90 s. */
const REUSE_POSITION_MS = 90 * 1000;

const ageOf = (r: Reading) => r.position.age_ms + Date.now() - r.capturedAt;

const NETWORK_ERROR: PunchOutcome = {
  ok: false,
  code: 'network',
  message: 'Sem ligação ao servidor. Verifique a internet e tente novamente.',
};

export const usePunch = (): UsePunchResult => {
  const [phase, setPhase] = useState<PunchPhase>('idle');
  const [outcome, setOutcome] = useState<PunchOutcome | null>(null);
  const [lastNote, setLastNote] = useState('');
  const inFlight = useRef(false);
  const lastRequest = useRef<LastRequest | null>(null);
  const warm = useRef<{ startedAt: number; reading: Promise<Reading> } | null>(null);

  const finish = (result: PunchOutcome): PunchOutcome => {
    setOutcome(result);
    setPhase(result.ok ? 'success' : 'error');
    return result;
  };

  const send = useCallback(
    async (
      method: PunchMethod,
      choice: PunchChoice,
      tag: TagPayload | undefined,
      reuse: LastRequest | null,
      remote?: { note: string }
    ): Promise<PunchOutcome | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setOutcome(null);
      try {
        let reading: Reading | null = reuse && ageOf(reuse) < REUSE_POSITION_MS ? reuse : null;
        if (!reading) {
          setPhase('locating');
          try {
            // Leitura iniciada em warmUp (se recente); senão lê agora.
            const warmed = warm.current;
            warm.current = null;
            if (warmed && Date.now() - warmed.startedAt < REUSE_POSITION_MS) {
              const early = await warmed.reading.catch(() => null);
              if (early && ageOf(early) < REUSE_POSITION_MS) reading = early;
            }
            reading ??= { position: await getBestPosition(), capturedAt: Date.now() };
          } catch (error: unknown) {
            return finish({
              ok: false,
              code: 'missing_position',
              message: getErrorMessage(error, getPunchMessage('missing_position')),
            });
          }
        }
        lastRequest.current = { ...reading, method, choice, tag };
        const note = (remote?.note ?? choice.note ?? '').trim();
        setLastNote(note);

        setPhase('sending');
        const { data, error } = await timeClockService.punch({
          method,
          tag,
          position: { ...reading.position, age_ms: ageOf(reading) },
          device_id: getDeviceId(),
          entry_type: choice.entryType,
          ...(note ? { note } : {}),
          ...(remote ? { remote: true } : {}),
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
    (method: PunchMethod, choice: PunchChoice, tag?: TagPayload) => send(method, choice, tag, null),
    [send]
  );

  const warmUp = useCallback(() => {
    if (warm.current && Date.now() - warm.current.startedAt < REUSE_POSITION_MS) return;
    const reading = getBestPosition().then(position => ({ position, capturedAt: Date.now() }));
    reading.catch(() => undefined); // o erro só interessa quando o registo for enviado
    warm.current = { startedAt: Date.now(), reading };
  }, []);

  const requestRemote = useCallback(
    async (note: string) => {
      const last = lastRequest.current;
      if (!last) return null;
      return send(last.method, last.choice, last.tag, last, { note });
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
    warm.current = null;
  }, []);

  return {
    phase,
    outcome,
    isBusy: phase === 'locating' || phase === 'sending',
    lastNote,
    punch,
    warmUp,
    requestRemote,
    swap,
    reset,
  };
};
