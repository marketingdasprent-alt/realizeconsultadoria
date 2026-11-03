import React from 'react';
import { LogIn, LogOut, UserMinus } from 'lucide-react';
import type { ChatMessage } from '../types';

/** Ícone conforme a frase gerada pelo servidor: entrou, saiu ou foi retirado do grupo. */
const iconFor = (text: string) =>
  /\bentrou|entraram\b/.test(text) ? LogIn : /\bsaiu\b/.test(text) ? LogOut : UserMinus;

/** Aviso a meio da conversa: "Ana entrou no grupo", "Rui saiu do grupo"… */
export const SystemNotice: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const text = message.text ?? '';
  const Icon = iconFor(text);
  return (
    <div className="flex justify-center py-1" role="status">
      <span className="inline-flex max-w-[85%] items-center gap-1.5 rounded-full bg-white px-3 py-1 text-center text-[12px] font-semibold text-rz-muted shadow-sm ring-1 ring-rz-line">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 break-words">{text}</span>
      </span>
    </div>
  );
};
