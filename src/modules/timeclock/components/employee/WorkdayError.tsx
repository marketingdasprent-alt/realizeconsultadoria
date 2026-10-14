import React from 'react';
import { XCircle } from 'lucide-react';

interface WorkdayErrorProps {
  message: string;
}

/** O registo não foi feito (sem internet, tag inválida, VPN bloqueada…). */
export const WorkdayError: React.FC<WorkdayErrorProps> = ({ message }) => (
  <div
    role="alert"
    className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
  >
    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
    <p>
      <span className="font-medium">Não registado.</span> {message}
    </p>
  </div>
);
