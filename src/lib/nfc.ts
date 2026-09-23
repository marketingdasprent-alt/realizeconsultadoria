// Web NFC (NDEFReader) — disponível no Chrome Android, incluindo a app Android
// (TWA). Não existe em iOS/Safari nem em desktop: aí o colaborador encosta o
// iPhone à tag (o iOS abre o URL da tag) ou usa o registo por GPS.

export interface TagPayload {
  /** Token de tag estática (NTAG213/215/216). */
  t?: string;
  /** PICCData cifrado de uma NTAG 424 DNA (SUN). */
  e?: string;
  /** SDMMAC de uma NTAG 424 DNA (SUN). */
  c?: string;
}

// Tipos mínimos: a Web NFC API não faz parte do lib DOM do TypeScript.
interface NdefRecordLike {
  recordType: string;
  encoding?: string;
  data?: DataView;
}

interface NdefReadingEventLike extends Event {
  serialNumber: string;
  message: { records: NdefRecordLike[] };
}

interface NdefReaderLike {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(
    message: { records: Array<{ recordType: string; data: string }> },
    options?: { signal?: AbortSignal; overwrite?: boolean }
  ): Promise<void>;
  onreading: ((event: NdefReadingEventLike) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
}

type NdefReaderCtor = new () => NdefReaderLike;

const getReaderCtor = (): NdefReaderCtor | null => {
  if (typeof window === 'undefined' || !('NDEFReader' in window)) return null;
  return (window as unknown as { NDEFReader: NdefReaderCtor }).NDEFReader;
};

export const isWebNfcSupported = (): boolean => getReaderCtor() !== null;

/** Extrai o payload de ponto de um URL de tag (…/ponto/nfc?t=… ou ?e=…&c=…). */
export const parseTagUrl = (raw: string): TagPayload | null => {
  try {
    const url = new URL(raw.trim());
    const t = url.searchParams.get('t');
    const e = url.searchParams.get('e');
    const c = url.searchParams.get('c');
    if (t) return { t };
    if (e && c) return { e, c };
    return null;
  } catch {
    return null;
  }
};

const decodeRecord = (record: NdefRecordLike): string | null => {
  if (!record.data) return null;
  if (record.recordType === 'url' || record.recordType === 'absolute-url') {
    return new TextDecoder().decode(record.data);
  }
  if (record.recordType === 'text') {
    return new TextDecoder(record.encoding || 'utf-8').decode(record.data);
  }
  return null;
};

export interface ScannedTag {
  payload: TagPayload;
  url: string;
  serialNumber: string;
}

const nfcError = (error: unknown): Error => {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return new Error('Permissão de NFC negada. Ative o NFC e permita o acesso nas definições.');
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error('Leitura cancelada.');
  }
  if (error instanceof DOMException && error.name === 'NotSupportedError') {
    return new Error('Este telemóvel não tem NFC. Use o registo por localização.');
  }
  if (error instanceof DOMException && error.name === 'NotReadableError') {
    // Android com o NFC desligado nas definições rápidas.
    return new Error('O NFC está desligado. Ative-o nas definições do telemóvel e tente de novo.');
  }
  return error instanceof Error ? error : new Error('Erro de NFC desconhecido.');
};

/**
 * Aguarda a leitura de uma tag de ponto. Deve ser chamado a partir de um
 * gesto do utilizador (clique). Abortar o `signal` termina a leitura.
 */
export const scanTimeClockTag = (signal: AbortSignal): Promise<ScannedTag> =>
  new Promise((resolve, reject) => {
    const Ctor = getReaderCtor();
    if (!Ctor) {
      reject(new Error('Este dispositivo não suporta leitura NFC na app.'));
      return;
    }
    const reader = new Ctor();
    reader.onreading = event => {
      for (const record of event.message.records) {
        const text = decodeRecord(record);
        const payload = text ? parseTagUrl(text) : null;
        if (text && payload) {
          resolve({ payload, url: text, serialNumber: event.serialNumber });
          return;
        }
      }
      reject(new Error('Esta tag não é uma tag de ponto.'));
    };
    reader.onreadingerror = () => reject(new Error('Não foi possível ler a tag. Tente novamente.'));
    reader.scan({ signal }).catch(error => reject(nfcError(error)));
  });

/** Grava um URL numa tag NFC regravável (NTAG213/215/216). */
export const writeUrlToTag = async (url: string, signal: AbortSignal): Promise<void> => {
  const Ctor = getReaderCtor();
  if (!Ctor) throw new Error('Este dispositivo não suporta gravação NFC.');
  try {
    await new Ctor().write(
      { records: [{ recordType: 'url', data: url }] },
      { signal, overwrite: true }
    );
  } catch (error) {
    throw nfcError(error);
  }
};
