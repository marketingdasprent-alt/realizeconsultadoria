import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Volume2, VolumeX, X } from 'lucide-react';
import { internalPath, parseMailPush, parseOpenMessage, type MailPopup } from '../lib/pushMessage';
import { isMailSoundOn, playMailSound, primeMailSound, setMailSoundOn } from '../lib/mailSound';

/** Quanto tempo o popup fica no ecrã se ninguém lhe tocar. */
const SHOW_MS = 20_000;

/**
 * Popup grande de email novo, dentro da app aberta (o aviso do sistema continua a aparecer fora
 * dela). Chega pelo service worker quando há um email novo; um seguinte substitui o atual e conta
 * quantos vieram. Também leva a app para o email quando a pessoa toca no aviso do sistema.
 */
export const NewMailPopup: React.FC = () => {
  const navigate = useNavigate();
  const [popup, setPopup] = useState<(MailPopup & { count: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [soundOn, setSoundOn] = useState(isMailSoundOn);

  // O som só pode tocar depois de a pessoa ter tocado na app: prepara-se no primeiro toque.
  useEffect(() => primeMailSound(), []);

  const toggleSound = () => {
    const next = !soundOn;
    setMailSoundOn(next);
    setSoundOn(next);
    if (next) void playMailSound({ force: true }); // ouve-se como vai soar
  };

  const close = useCallback(() => {
    clearTimeout(timer.current);
    setPopup(null);
  }, []);

  const open = useCallback(
    (url: string) => {
      close();
      const path = internalPath(url, window.location.origin);
      if (path) navigate(path);
    },
    [close, navigate]
  );

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const mail = parseMailPush(event.data);
      if (mail) {
        setSoundOn(isMailSoundOn());
        void playMailSound(); // um som por popup (no máximo um a cada poucos segundos)
        setPopup(current => ({ ...mail, count: (current?.count ?? 0) + 1 }));
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setPopup(null), SHOW_MS);
        return;
      }
      const url = parseOpenMessage(event.data);
      if (url) open(url);
    };
    const worker = navigator.serviceWorker;
    worker.addEventListener('message', onMessage);
    return () => {
      worker.removeEventListener('message', onMessage);
      clearTimeout(timer.current);
    };
  }, [open]);

  if (!popup) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex justify-center sm:inset-x-auto sm:right-5 sm:top-5 sm:block"
    >
      <div className="pointer-events-auto w-full max-w-[28rem] overflow-hidden rounded-3xl bg-white shadow-[0_24px_70px_-12px_rgba(0,0,0,0.45)] ring-2 ring-rz-primary animate-in fade-in-0 slide-in-from-top-6 duration-300 sm:w-[28rem]">
        <div className="h-1.5 bg-rz-primary" />
        <div className="flex items-start gap-4 p-5">
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-rz-primary/30" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-rz-primary text-white">
              <Mail className="h-7 w-7" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-rz-primary">
              {popup.count > 1 ? `${popup.count} emails novos` : 'Email novo'}
            </p>
            <p className="mt-0.5 break-words text-[18px] font-extrabold leading-snug text-rz-ink">
              {popup.title}
            </p>
            {popup.body && (
              <p className="mt-1 line-clamp-3 break-words text-[15px] leading-snug text-rz-muted">
                {popup.body}
              </p>
            )}
          </div>
          <div className="-mr-1 -mt-1 flex shrink-0 items-center">
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundOn}
              aria-label={soundOn ? 'Desligar o som dos avisos' : 'Ligar o som dos avisos'}
              title={soundOn ? 'Som dos avisos ligado' : 'Som dos avisos desligado'}
              className="rounded-full p-1.5 text-rz-muted hover:bg-rz-canvas"
            >
              {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar o aviso"
              className="rounded-full p-1.5 text-rz-muted hover:bg-rz-canvas"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={() => open(popup.url)}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-rz-primary text-[15px] font-bold text-white shadow-sm hover:opacity-90"
          >
            <Mail className="h-5 w-5" /> Abrir o email
          </button>
          <button
            type="button"
            onClick={close}
            className="h-12 rounded-full px-5 text-[15px] font-semibold text-rz-muted ring-1 ring-rz-line hover:bg-rz-canvas"
          >
            Depois
          </button>
        </div>
      </div>
    </div>
  );
};
