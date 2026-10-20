import React, { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { geoHintReason, getGeoPermission, wasGeoGranted } from '@/lib/geolocation';

interface LocationPermissionHintProps {
  /** Muda depois de cada registo: volta a ler a permissão. */
  refreshKey: unknown;
}

const DISMISS_KEY = 'rz.geo.hint.dismissed';
const DISMISS_DAYS = 14;

const isDismissed = (): boolean => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
};

/** iPhone/iPad (o iPad recente diz-se Mac, mas tem ecrã tátil), Android ou computador. */
const platform = (): 'ios' | 'android' | 'desktop' => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    return 'ios';
  return /Android/.test(ua) ? 'android' : 'desktop';
};

const STEPS = {
  ios: 'iPhone: Definições → Apps → Safari → Localização → «Permitir». E em Privacidade e Segurança → Serviços de localização → Sites do Safari → «Durante a utilização».',
  android:
    'Android: no aviso escolha «Permitir» (não «Só desta vez»). Ou no Chrome: ⋮ → Definições → Definições de sites → Localização.',
  desktop:
    'Computador: carregue no cadeado ao lado do endereço → Localização → «Permitir» (não «Permitir desta vez»).',
};

/**
 * O ponto regista-se sem localização, mas assim não se sabe onde a pessoa trabalhou. Quando o
 * aparelho bloqueia a localização ou volta a pedi-la, explica como a deixar sempre permitida.
 */
export const LocationPermissionHint: React.FC<LocationPermissionHintProps> = ({ refreshKey }) => {
  const [reason, setReason] = useState<'blocked' | 'asks-again' | null>(null);
  const [hidden, setHidden] = useState(isDismissed);

  useEffect(() => {
    let alive = true;
    void getGeoPermission().then(state => {
      if (alive) setReason(geoHintReason(state, wasGeoGranted()));
    });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (!reason || hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Sem armazenamento: volta a aparecer da próxima vez.
    }
  };

  return (
    <div className="relative rounded-xl border border-border bg-background p-3 pr-9 text-xs">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label="Esconder"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="flex items-center gap-1.5 font-semibold">
        <MapPin className="h-4 w-4 text-gold" />
        {reason === 'blocked'
          ? 'A localização está bloqueada neste aparelho'
          : 'Para não pedir a localização sempre'}
      </p>
      <p className="mt-1 text-muted-foreground">
        {reason === 'blocked'
          ? 'O ponto fica registado, mas sem o sítio onde está. '
          : 'Permita a localização de vez: '}
        {STEPS[platform()]}
      </p>
    </div>
  );
};
