import { X, Menu } from 'lucide-react';
import logo from '@/assets/logo-realize.png';

interface AdminMobileHeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  userInitial: string;
}

export const AdminMobileHeader = ({
  isSidebarOpen,
  setIsSidebarOpen,
  userInitial,
}: AdminMobileHeaderProps) => {
  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 h-14 lg:h-16 bg-sidebar z-50 flex items-center justify-between px-4 print:hidden">
      <div className="flex items-center gap-3">
        <img
          src={logo}
          alt="Realize Consultadoria"
          className="h-10 lg:h-16 w-auto brightness-0 invert"
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center text-sm font-semibold text-sidebar-primary-foreground">
          {userInitial}
        </div>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-sidebar-foreground p-2"
        >
          {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
};
