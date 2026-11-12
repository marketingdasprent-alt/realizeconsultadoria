import React from 'react';
import { ArrowLeft, Inbox, Layers, PenLine } from 'lucide-react';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { MAIL_PROVIDERS, type MailProvider } from '../lib/providers';

const FEATURES = [
  { icon: Layers, text: 'Várias contas e uma caixa de entrada unificada' },
  { icon: PenLine, text: 'Assinatura própria em cada conta' },
  { icon: Inbox, text: 'Transformar um email em tarefa ou evento' },
];

interface ProviderGridProps {
  onPick: (provider: MailProvider) => void;
  /** Já há caixas ligadas: mostra "Voltar ao email". */
  onBack?: () => void;
}

/** Escolher o fornecedor da caixa a ligar, como no Bitrix24 (briefing §9). */
export const ProviderGrid: React.FC<ProviderGridProps> = ({ onPick, onBack }) => {
  // App de email para clientes de fora: sem Gmail (a app Google ainda não está criada) nem
  // "tarefa ou evento" (são da Realize)
  const { mailOnly } = useWorkspace();
  const providers = mailOnly
    ? MAIL_PROVIDERS.filter(p => p.method !== 'oauth-google')
    : MAIL_PROVIDERS;
  const features = mailOnly ? FEATURES.slice(0, 2) : FEATURES;
  return (
    <div className="rz-scroll h-full overflow-y-auto bg-rz-aurora">
      <div className="rz-rise mx-auto max-w-4xl px-4 pb-32 pt-10 md:pb-12 md:pt-16">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rz-glass mb-6 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao email
          </button>
        )}
        <h1 className="text-center text-[26px] font-extrabold text-white md:text-[32px]">
          {mailOnly
            ? 'Entre com a sua caixa de email'
            : 'Use e gira as suas caixas de correio no Realize'}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-center text-[15px] text-white/75">
          {mailOnly
            ? 'Escolha o fornecedor e entre com o seu email e a palavra-passe dele. Não precisa de criar conta.'
            : 'Escolha o seu fornecedor de email. Pode ligar várias contas.'}
        </p>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
          {providers.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => onPick(item)}
              className="group flex h-[112px] flex-col items-center justify-center gap-2 rounded-[22px] bg-white px-3 text-center shadow-rz-pop transition-transform hover:-translate-y-1"
            >
              <span className="transition-transform group-hover:scale-110">
                <item.Logo />
              </span>
              <span className="text-[14px] font-bold text-rz-ink">{item.name}</span>
              {item.hint && (
                <span className="-mt-1.5 text-[11px] font-semibold text-rz-muted">{item.hint}</span>
              )}
            </button>
          ))}
        </div>

        <ul className="mx-auto mt-10 grid max-w-3xl gap-2.5 sm:grid-cols-3">
          {features.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="rz-glass flex items-center gap-3 rounded-2xl px-4 py-3 text-[13.5px] font-semibold text-white"
            >
              <Icon className="h-5 w-5 shrink-0 text-amber-200" /> {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
