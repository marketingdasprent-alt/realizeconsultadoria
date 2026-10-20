// Leitura de localização para o registo de ponto.

export interface PositionPayload {
  lat: number;
  lng: number;
  accuracy: number;
  /** Idade da leitura medida no próprio dispositivo (imune a relógio desacertado). */
  age_ms: number;
}

interface BestPositionOptions {
  /** Tempo máximo a aguardar por uma leitura melhor. */
  maxWaitMs?: number;
  /** Termina logo que a precisão seja igual ou melhor do que isto (metros). */
  targetAccuracyM?: number;
  /**
   * Termina se a leitura não melhorar durante este tempo. Num PC (localização por Wi-Fi)
   * a precisão nunca chega aos 25 m e esperar maxWaitMs inteiro não adiantava nada.
   */
  settleMs?: number;
}

const geoErrorMessage = (error: GeolocationPositionError): string => {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Permissão de localização negada. Ative-a nas definições do telemóvel/browser para registar o ponto.';
  }
  if (error.code === error.TIMEOUT) {
    return 'Não foi possível obter a localização a tempo. Verifique se o GPS está ligado.';
  }
  return 'Localização indisponível. Verifique se o GPS está ligado.';
};

const toPayload = (position: GeolocationPosition): PositionPayload => ({
  lat: position.coords.latitude,
  lng: position.coords.longitude,
  accuracy: position.coords.accuracy,
  age_ms: Date.now() - position.timestamp,
});

/**
 * Observa o GPS durante alguns segundos e devolve a leitura mais precisa.
 * Dentro de edifícios a primeira leitura costuma ser a pior (Wi-Fi/antenas).
 */
export const getBestPosition = ({
  maxWaitMs = 8000,
  targetAccuracyM = 25,
  settleMs = 2000,
}: BestPositionOptions = {}): Promise<PositionPayload> =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('Este dispositivo não suporta localização.'));
      return;
    }

    const hardLimitMs = maxWaitMs + 7000;
    const startedAt = Date.now();
    let best: GeolocationPosition | null = null;
    let settled = false;
    let watchId: number | null = null;
    let lastError: GeolocationPositionError | null = null;
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      timers.forEach(clearTimeout);
      if (best && !error) {
        // Pedimos sempre leituras novas (maximumAge 0). Em alguns Android o carimbo
        // de hora vem do relógio do GPS e, com o relógio do telemóvel desacertado,
        // a leitura parecia ter minutos ("posição antiga"). A idade real nunca
        // passa do tempo que estivemos a ler.
        const payload = toPayload(best);
        resolve({
          ...payload,
          age_ms: Math.max(0, Math.min(payload.age_ms, Date.now() - startedAt)),
        });
      } else reject(error ?? new Error('Não foi possível obter a localização.'));
    };

    // Ao fim de maxWaitMs usa a melhor leitura; se ainda não há nenhuma, espera até ao limite.
    timers.push(
      setTimeout(() => {
        if (best) finish();
      }, maxWaitMs)
    );
    timers.push(
      setTimeout(() => {
        if (best) finish();
        else
          finish(
            new Error(
              lastError
                ? geoErrorMessage(lastError)
                : 'Não foi possível obter a localização a tempo. Verifique se o GPS está ligado.'
            )
          );
      }, hardLimitMs)
    );

    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    watchId = navigator.geolocation.watchPosition(
      position => {
        if (best && position.coords.accuracy >= best.coords.accuracy) return;
        best = position;
        if (position.coords.accuracy <= targetAccuracyM) return finish();
        // Leitura melhor: dá-lhe settleMs para melhorar outra vez; se não melhorar, usa esta.
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => finish(), settleMs);
        timers.push(settleTimer);
      },
      error => {
        // Permissão negada falha logo; erros transitórios esperam pelo limite.
        lastError = error;
        if (error.code === error.PERMISSION_DENIED) finish(new Error(geoErrorMessage(error)));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: hardLimitMs }
    );
  });

const DEVICE_KEY = 'realize_device_id';

/**
 * Identificador aleatório do dispositivo (não é impressão digital do
 * hardware). Serve para detetar o mesmo telemóvel a registar por colegas.
 */
export const getDeviceId = (): string | null => {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
};

export type GeoPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Estado da permissão de localização, sem a pedir. 'unknown' em browsers sem a
 * Permissions API (iPhone antigo): aí a localização só se pede ao registar.
 */
export const getGeoPermission = async (): Promise<GeoPermission> => {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return status.state;
  } catch {
    return 'unknown';
  }
};

const GRANTED_KEY = 'rz.geo.granted';

/** Este aparelho já deu a localização alguma vez (para notar quando a "esquece"). */
export const rememberGeoGranted = (): void => {
  try {
    localStorage.setItem(GRANTED_KEY, '1');
  } catch {
    // Sem armazenamento: só se perde a dica de "permitir sempre".
  }
};

export const wasGeoGranted = (): boolean => {
  try {
    return localStorage.getItem(GRANTED_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Explicar como deixar a localização sempre permitida: quando está bloqueada, ou quando
 * o aparelho a deu antes e voltou a perguntar (escolheu "só desta vez").
 */
export const geoHintReason = (
  state: GeoPermission,
  grantedBefore: boolean
): 'blocked' | 'asks-again' | null => {
  if (state === 'denied') return 'blocked';
  if (state === 'prompt' && grantedBefore) return 'asks-again';
  return null;
};
