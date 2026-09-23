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
}: BestPositionOptions = {}): Promise<PositionPayload> =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('Este dispositivo não suporta localização.'));
      return;
    }

    const hardLimitMs = maxWaitMs + 7000;
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
      if (best && !error) resolve(toPayload(best));
      else reject(error ?? new Error('Não foi possível obter a localização.'));
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

    watchId = navigator.geolocation.watchPosition(
      position => {
        if (!best || position.coords.accuracy < best.coords.accuracy) best = position;
        if (position.coords.accuracy <= targetAccuracyM) finish();
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
