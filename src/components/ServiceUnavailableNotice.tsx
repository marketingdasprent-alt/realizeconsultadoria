// src/components/ServiceUnavailableNotice.tsx
// Aviso enquanto a BD não responde e o AuthContext tenta de novo (com espera crescente)

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceUnavailableNoticeProps {
  className?: string;
}

export const ServiceUnavailableNotice: React.FC<ServiceUnavailableNoticeProps> = ({
  className,
}) => (
  <div role="status" className={cn('flex flex-col items-center gap-2 text-center', className)}>
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
    <p className="text-sm font-medium">Serviço indisponível, a tentar de novo…</p>
    <p className="text-xs text-muted-foreground">
      O servidor não está a responder. Não precisa de fazer nada: a app continua sozinha assim que
      ele voltar.
    </p>
  </div>
);
