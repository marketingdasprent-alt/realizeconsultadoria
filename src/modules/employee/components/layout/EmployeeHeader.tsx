import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronDown, Key, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import logo from '@/assets/logo-realize.png';

interface EmployeeHeaderProps {
  name: string;
  companyName: string | null;
  onChangePassword: () => void;
  onLogout: () => void;
}

export const EmployeeHeader: React.FC<EmployeeHeaderProps> = ({
  name,
  companyName,
  onChangePassword,
  onLogout,
}) => {
  const firstName = name.split(' ')[0] || name;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={logo} alt="Realize Consultadoria" className="h-9 w-auto lg:h-12" />
          <div className="min-w-0">
            <p className="truncate font-medium">Olá, {firstName}</p>
            <p className="truncate text-xs text-muted-foreground capitalize">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })}
              {companyName ? ` · ${companyName}` : ''}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-11 gap-1 px-2" aria-label="Conta">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-gold">
                <User className="h-4 w-4" />
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={onChangePassword} className="cursor-pointer">
              <Key className="mr-2 h-4 w-4" /> Alterar palavra-passe
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onLogout}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Terminar sessão
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
