import { useCallback, useRef, useState } from 'react';
import { getBestPosition, getDeviceId, type PositionPayload } from '@/lib/geolocation';
import type { TagPayload } from '@/lib/nfc';
import { getPunchMessage, type PunchMethod } from '@/lib/timeclock';
import type { WorkdayAction, WorkdayStatus } from '@/lib/workday';
import { timeClockService, type PunchEntry } from '../services/timeClockService';

export type PunchPhase = 'idle' | 'locating' | 'sending' | 'done';

/** Uma ação da jornada pedida pelo colaborador. */
export interface PunchInput {
  action: WorkdayAction;
  method: PunchMethod;
  note?: string;
  tag?: TagPayload;
  /** Hora de um registo esquecido (ISO); `note` é o motivo. */
  at?: string;
}

export interface PunchOutcome {
  ok: boolean;
  code: string;
  action: WorkdayAction;
  message: string;
  entry: PunchEntry | null;
  state: WorkdayStatus | null;
}

interface UsePunchResult {
  phase: PunchPhase;
  outcome: PunchOutcome | null;
  isBusy: boolean;
  /** Lê o GPS e regista a ação. Sem GPS regista na mesma (fica a aguardar aprovação). */
  punch: (input: PunchInput) => Promise<PunchOutcome | null>;
  /** Começa já a ler o GPS (ao abrir o painel), para o registo ser imediato. */
  warmUp: () => void;
  /** Esquece o último resultado. */
  clear: () => void;
}

interface Reading {
  position: PositionPayload;
  capturedAt: number;
}

/** O servidor aceita leituras até 2 min; reutiliza-se até 90 s. */
const REUSE_POSITION_MS = 90 * 1000;

const ageOf = (r: Reading) => r.position.age_ms + Date.now() - r.capturedAt;

export const usePunch = (): UsePunchResult => {
  const [phase, setPhase] = useState<PunchPhase>('idle');
  const [outcome, setOutcome] = useState<PunchOutcome | null>(null);
  const inFlight = useRef(false);
  const warm = useRef<{ startedAt: number; reading: Promise<Reading> } | null>(null);

  /** Posição para o registo, ou null sem GPS (o ponto regista-se na mesma). */
  const readPosition = useCallback(async (): Promise<PositionPayload | null> => {
    const warmed = warm.current;
    warm.current = null;
    try {
      let reading: Reading | null = null;
      if (warmed && Date.now() - warmed.startedAt < REUSE_POSITION_MS) {
        // Se a leitura antecipada falhou (GPS desligado, sem permissão), não se espera outra vez.
        reading = await warmed.reading;
        if (ageOf(reading) >= REUSE_POSITION_MS) reading = null;
      }
      reading ??= { position: await getBestPosition(), capturedAt: Date.now() };
      return { ...reading.position, age_ms: ageOf(reading) };
    } catch {
      return null;
    }
  }, []);

  const punch = useCallback(
    async (input: PunchInput): Promise<PunchOutcome | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setOutcome(null);
      try {
        setPhase('locating');
        const position = await readPosition();

        setPhase('sending');
        const note = input.note?.trim();
        const { data, error } = await timeClockService.punch({
          method: input.method,
          action: input.action,
          tag: input.tag,
          position,
          device_id: getDeviceId(),
          ...(note ? { note } : {}),
          ...(input.at ? { at: input.at } : {}),
        });
        const code = error || !data ? 'network' : data.code;
        const result: PunchOutcome = {
          ok: !!data?.ok && !error,
          code,
          action: input.action,
          message: getPunchMessage(code),
          entry: data?.entry ?? null,
          state: data?.state ?? null,
        };
        setOutcome(result);
        setPhase('done');
        return result;
      } finally {
        inFlight.current = false;
      }
    },
    [readPosition]
  );

  const warmUp = useCallback(() => {
    if (warm.current && Date.now() - warm.current.startedAt < REUSE_POSITION_MS) return;
    const reading = getBestPosition().then(position => ({ position, capturedAt: Date.now() }));
    reading.catch(() => undefined); // o erro só interessa quando o registo for enviado
    warm.current = { startedAt: Date.now(), reading };
  }, []);

  const clear = useCallback(() => {
    setPhase('idle');
    setOutcome(null);
  }, []);

  return {
    phase,
    outcome,
    isBusy: phase === 'locating' || phase === 'sending',
    punch,
    warmUp,
    clear,
  };
};
