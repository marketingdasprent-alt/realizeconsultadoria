import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import logo from '@/assets/logo-realize.png';

interface EmployeeTimeClockHeaderProps {
  subtitle?: string;
}

export const EmployeeTimeClockHeader: React.FC<EmployeeTimeClockHeaderProps> = ({ subtitle }) => {
  const navigate = useNavigate();
  return (
    <header className="bg-background border-b border-border sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3 lg:py-4 flex items-center gap-2 lg:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 lg:h-10 lg:w-10"
          onClick={() => navigate(ROUTES.EMPLOYEE.DASHBOARD)}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <img
          src={logo}
          alt="Realize Consultadoria"
          className="h-8 lg:h-12 w-auto hidden sm:block"
        />
        <div>
          <h1 className="font-display text-base lg:text-xl font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 lg:h-5 lg:w-5 text-gold" />O Meu Ponto
          </h1>
          {subtitle && <p className="text-xs lg:text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
};
