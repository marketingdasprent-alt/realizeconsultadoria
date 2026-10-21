import React from 'react';
import { LogOut } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AdminUserCardProps {
  userName: string;
  userInitial: string;
  collapsed?: boolean;
  onLogout: () => void;
}

const Avatar: React.FC<{ initial: string }> = ({ initial }) => (
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F3D9A4] to-[#C9A15B] text-sm font-bold text-[#3b2a0c]">
    {initial}
  </span>
);

/** Quem está ligado + terminar sessão, no fundo do menu (vidro sobre a aurora). */
export const AdminUserCard: React.FC<AdminUserCardProps> = ({
  userName,
  userInitial,
  collapsed = false,
  onLogout,
}) => {
  if (collapsed) {
    return (
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onLogout}
            className="mx-auto flex rounded-full ring-2 ring-transparent transition hover:ring-white/30"
            aria-label="Terminar sessão"
          >
            <Avatar initial={userInitial} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="rounded-xl font-medium">
          {userName} · Terminar sessão
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="rz-glass flex items-center gap-3 rounded-2xl p-2.5">
      <Avatar initial={userInitial} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-white">{userName}</p>
        <p className="text-[11.5px] text-white/55">Administrador</p>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-white/65 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Terminar sessão"
        title="Terminar sessão"
      >
        <LogOut className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
};
