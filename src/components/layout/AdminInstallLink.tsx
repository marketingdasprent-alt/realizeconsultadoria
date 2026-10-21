import React from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { isStandalone } from '@/lib/pwa-install';
import { cn } from '@/lib/utils';

interface AdminInstallLinkProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

/** "Instalar app" no fundo do menu (some quando o admin já está aberto como app instalada). */
export const AdminInstallLink: React.FC<AdminInstallLinkProps> = ({ collapsed, onNavigate }) => {
  if (isStandalone()) return null;
  return (
    <Link
      to={`${ROUTES.PUBLIC.INSTALL}?app=admin`}
      onClick={onNavigate}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-[13px] font-medium text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white',
        collapsed && 'justify-center px-0'
      )}
      aria-label="Instalar app"
      title="Instalar o Realize Admin neste aparelho"
    >
      <Download className={cn('h-5 w-5', !collapsed && 'ml-1.5')} />
      {!collapsed && <span>Instalar app</span>}
    </Link>
  );
};
