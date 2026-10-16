import React from 'react';
import { Menu, X } from 'lucide-react';
import { BrandMark } from '@/modules/workspace/components/BrandMark';

interface AdminMobileHeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

/** Barra do topo no telemóvel/tablet: marca + botão do menu, sobre a aurora. */
export const AdminMobileHeader: React.FC<AdminMobileHeaderProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
}) => (
  <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between bg-rz-aurora px-4 lg:hidden print:hidden">
    <BrandMark subtitle="Admin" />
    <button
      type="button"
      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      className="flex h-10 w-10 items-center justify-center rounded-2xl text-white transition-colors hover:bg-white/10"
      aria-label={isSidebarOpen ? 'Fechar menu' : 'Abrir menu'}
    >
      {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
    </button>
  </header>
);
