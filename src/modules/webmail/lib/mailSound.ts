// Som curto do popup de email novo. Gera-se no próprio navegador (sem ficheiro de áudio) e
// respeita as regras dele: só toca depois de a pessoa ter tocado ou escrito na app; se o
// navegador não deixar, fica em silêncio, sem erro.

const STORAGE_KEY = 'rz.mail-sound';
/** Entre dois sons, no mínimo isto (vários emails seguidos não tocam em cadeia). */
export const MIN_GAP_MS = 5000;

/** O som dos avisos está ligado? (Por omissão, sim.) */
export const isMailSoundOn = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
};

export const setMailSoundOn = (on: boolean) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    // sem armazenamento: vale só até recarregar
  }
};

/** Quanto se espera que o navegador liberte o áudio. Sem interação da pessoa, o `resume()` fica
 * pendente para sempre: sem limite, o som tocava atrasado, só quando a pessoa clicasse. */
const RESUME_WAIT_MS = 300;

let context: AudioContext | null = null;
let lastPlayedAt = 0;

const audioContext = (): AudioContext | null => {
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
};

/**
 * Prepara o som no primeiro toque ou tecla da pessoa na app (por exemplo, ao carregar em
 * "Ativar avisos"). Os navegadores só libertam o áudio depois de uma ação da pessoa.
 */
export const primeMailSound = (): (() => void) => {
  const events = ['pointerdown', 'keydown'] as const;
  const stop = () => events.forEach(name => window.removeEventListener(name, unlock, true));
  function unlock() {
    stop();
    void audioContext()
      ?.resume()
      .catch(() => undefined);
  }
  events.forEach(name => window.addEventListener(name, unlock, true));
  return stop;
};

const tone = (
  ctx: AudioContext,
  frequency: number,
  start: number,
  length: number,
  peak: number
) => {
  const at = ctx.currentTime + start;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + length + 0.05);
};

/**
 * Toca o sinal (cerca de 1 segundo, suave). Não toca com o som desligado, antes de a pessoa ter
 * interagido com a app, ou se já tocou há menos de {@link MIN_GAP_MS} (`force`: a pessoa acabou
 * de pedir para o ouvir). Devolve se tocou; nunca lança erro.
 */
export const playMailSound = async (options: { force?: boolean } = {}): Promise<boolean> => {
  try {
    if (!isMailSoundOn()) return false;
    const now = Date.now();
    if (!options.force && now - lastPlayedAt < MIN_GAP_MS) return false;
    const ctx = audioContext();
    if (!ctx) return false;
    // Marca já, para dois emails no mesmo instante não tocarem duas vezes.
    lastPlayedAt = now;
    if (ctx.state !== 'running') {
      await Promise.race([
        ctx.resume().catch(() => undefined),
        new Promise(resolve => setTimeout(resolve, RESUME_WAIT_MS)),
      ]);
    }
    if (ctx.state !== 'running') {
      lastPlayedAt = 0; // o navegador bloqueou: a próxima tentativa pode funcionar
      return false;
    }
    tone(ctx, 784, 0, 0.55, 0.14);
    tone(ctx, 1175, 0.18, 0.75, 0.1);
    return true;
  } catch {
    return false;
  }
};

/** Só para os testes. */
export const resetMailSoundForTests = () => {
  context = null;
  lastPlayedAt = 0;
};
