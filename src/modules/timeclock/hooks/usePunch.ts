import { useCallback, useRef, useState } from 'react';
import { getBestPosition, getDeviceId } from '@/lib/geolocation';
import type { TagPayload } from '@/lib/nfc';
import { getPunchMessage, type EntryType, type PunchMethod } from '@/lib/timeclock';
import { timeClockService, type PunchResponse } from '../services/timeClockService';

export type PunchPhase = 'idle' | 'locating' | 'sending' | 'success' | 'error';

export interface PunchOutcome {
  ok: boolean;
  code: string;
  message: string;
  entry?: PunchResponse['entry'];
}

interface UsePunchResult {
  phase: PunchPhase;
  outcome: PunchOutcome | null;
  isBusy: boolean;
  /** Obtém a localização e envia o registo para validação no servidor. */
  punch: (
    method: PunchMethod,
    tag?: TagPayload,
    entryType?: EntryType
  ) => Promise<PunchOutcome | null>;
  reset: () => void;
}

export const usePunch = (): UsePunchResult => {
  const [phase, setPhase] = useState<PunchPhase>('idle');
  const [outcome, setOutcome] = useState<PunchOutcome | null>(null);
  const inFlight = useRef(false);

  const finish = (result: PunchOutcome): PunchOutcome => {
    setOutcome(result);
    setPhase(result.ok ? 'success' : 'error');
    return result;
  };

  const punch = useCallback(
    async (method: PunchMethod, tag?: TagPayload, entryType?: EntryType) => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setOutcome(null);
      try {
        setPhase('locating');
        let position;
        try {
          position = await getBestPosition();
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : getPunchMessage('missing_position');
          return finish({ ok: false, code: 'missing_position', message });
        }

        setPhase('sending');
        const { data, error } = await timeClockService.punch({
          method,
          tag,
          position,
          device_id: getDeviceId(),
          entry_type: entryType,
        });
        if (error || !data) {
          return finish({
            ok: false,
            code: 'network',
            message: 'Sem ligação ao servidor. Verifique a internet e tente novamente.',
          });
        }
        return finish({
          ok: data.ok,
          code: data.code,
          message: getPunchMessage(data.code),
          entry: data.entry,
        });
      } finally {
        inFlight.current = false;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setOutcome(null);
  }, []);

  return { phase, outcome, isBusy: phase === 'locating' || phase === 'sending', punch, reset };
};
