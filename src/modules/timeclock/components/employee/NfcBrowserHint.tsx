import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import { useDeviceDetect } from '@/hooks/useDeviceDetect';

interface NfcBrowserHintProps {
  /** O ponto ficou registado (muda a mensagem do iPhone). */
  isRegistered: boolean;
}

const DISMISS_KEY = 'realize_nfc_browser_hint_dismissed';

const readDismissed = (): boolean => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * A tag abre sempre um link: no iPhone vai sempre para o Safari; no Android vai
 * para o Chrome até a pessoa deixar a app Realize abrir os links do domínio.
 * Explica isto quando o registo foi feito no browser e não na app instalada.
 */
export const NfcBrowserHint: React.FC<NfcBrowserHintProps> = ({ isRegistered }) => {
  const { isAndroid, isIOS, isPWA } = useDeviceDetect();
  const [isDismissed, setIsDismissed] = useState(readDismissed);

  if (isPWA || isDismissed || (!isAndroid && !isIOS)) return null;

  const dismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Sem armazenamento (modo privado): volta a aparecer da próxima vez.
    }
  };

  return (
    <div className="relative rounded-lg border border-border bg-secondary p-3 pr-9 text-sm">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label="Não mostrar outra vez"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-gold" />
        {isAndroid ? (
          <div className="space-y-1">
            <p className="font-medium">Quer que a tag abra a app Realize em vez do browser?</p>
            <p className="text-muted-foreground">
              Com a app instalada, faça isto uma vez:{' '}
              <strong>Definições → Aplicações → Realize → Abrir por predefinição</strong> e ative{' '}
              <strong>Abrir links suportados</strong> (nos Samsung:{' '}
              <strong>Definir como predefinição</strong>).
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            No iPhone a tag abre sempre no Safari: a Apple não deixa abrir a app instalada.
            {isRegistered &&
              ' O registo fica feito na mesma; pode fechar este separador e a app mostra-o quando a abrir.'}
          </p>
        )}
      </div>
    </div>
  );
};
