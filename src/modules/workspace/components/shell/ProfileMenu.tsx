import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Download, KeyRound, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ROUTES } from '@/lib/constants';
import { useOptionalWorkday } from '@/modules/timeclock/context/useWorkday';
import { WorkdayPanel } from '@/modules/timeclock/components/employee/WorkdayPanel';
import { useWorkspace } from '../../context/workspaceContext';
import { SETTINGS_MODULE, modulePath } from '../../lib/navigation';
import { UserAvatar } from '../UserAvatar';

const ROW =
  'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium transition-colors hover:bg-rz-canvas';

/** Menu da conta (briefing §23), inspirado no painel do Bitrix24: perfil, ponto e conta. */
export const ProfileMenu: React.FC = () => {
  const { user, basePath, onLogout, onChangePassword } = useWorkspace();
  const workday = useOptionalWorkday();
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);
  const role = [user.position, user.companyName].filter(Boolean).join(' · ');

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="Conta e perfil"
        >
          <UserAvatar name={user.name} size="sm" status="online" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="w-[min(23rem,calc(100vw-1.5rem))] space-y-2 rounded-[28px] border-white/60 bg-rz-canvas p-2 shadow-rz-pop"
      >
        <div className="space-y-3 rounded-[22px] bg-white p-3 shadow-rz-soft">
          <Link
            to={`${basePath}/perfil`}
            onClick={close}
            className="flex items-center gap-3 rounded-2xl p-1 transition-colors hover:bg-rz-canvas"
          >
            <UserAvatar name={user.name} size="lg" status="online" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-[17px] font-bold">
                <span className="truncate">{user.name}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-rz-muted" />
              </span>
              {role && (
                <span className="mt-1 inline-block max-w-full truncate rounded-full bg-rz-primary-soft px-2.5 py-0.5 text-xs font-semibold text-rz-primary">
                  {role}
                </span>
              )}
            </span>
          </Link>
          {workday?.employee && <WorkdayPanel showPageLink onNavigate={close} hideTimeline />}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={TILE} onClick={() => (close(), onChangePassword())}>
              <ShieldCheck className="h-5 w-5 text-rz-primary" /> Segurança
            </button>
            <Link to={ROUTES.PUBLIC.INSTALL} onClick={close} className={TILE}>
              <Download className="h-5 w-5 text-rz-primary" /> Instalar app
            </Link>
          </div>
        </div>
        <div className="rounded-[22px] bg-white p-1.5 shadow-rz-soft">
          <Link to={modulePath(basePath, SETTINGS_MODULE)} onClick={close} className={ROW}>
            <Settings className="h-[18px] w-[18px] text-rz-muted" /> Definições
          </Link>
          <button type="button" className={ROW} onClick={() => (close(), onChangePassword())}>
            <KeyRound className="h-[18px] w-[18px] text-rz-muted" /> Alterar palavra-passe
          </button>
          <button type="button" className={`${ROW} text-rose-600`} onClick={onLogout}>
            <LogOut className="h-[18px] w-[18px]" /> Terminar sessão
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const TILE =
  'flex flex-col items-center gap-1.5 rounded-2xl border border-rz-line bg-white px-3 py-3 text-[13px] font-semibold transition-colors hover:border-rz-primary/40 hover:bg-rz-primary-soft';
