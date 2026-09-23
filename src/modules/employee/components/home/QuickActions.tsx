import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, Headset, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';

/** Atalhos para as três ações mais comuns; cada uma abre o diálogo respetivo. */
export const QuickActions: React.FC = () => {
  const navigate = useNavigate();
  const actions = [
    { label: 'Novo pedido', icon: CalendarPlus, to: `${ROUTES.EMPLOYEE.REQUESTS}?novo=1` },
    { label: 'Enviar documento', icon: Upload, to: `${ROUTES.EMPLOYEE.DOCUMENTS}?enviar=1` },
    { label: 'Pedir ajuda', icon: Headset, to: `${ROUTES.EMPLOYEE.TICKETS}?novo=1` },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {actions.map(a => (
        <Button
          key={a.label}
          variant="outline"
          className="h-auto flex-col gap-1.5 bg-background py-3 text-xs"
          onClick={() => navigate(a.to)}
        >
          <a.icon className="h-5 w-5 text-gold" />
          {a.label}
        </Button>
      ))}
    </div>
  );
};
