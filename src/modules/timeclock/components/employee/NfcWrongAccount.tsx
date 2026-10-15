import React from 'react';
import { Loader2, LogIn, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NfcWrongAccountProps {
  email: string | null;
  isSwitching: boolean;
  onSwitch: () => void;
}

/**
 * A tag foi lida com uma sessão que não é de colaborador (ex.: admin no Chrome do
 * Android, que partilha a sessão com a app instalada). Em vez de mandar a pessoa
 * para o painel e perder a leitura, explica e deixa trocar de conta.
 */
export const NfcWrongAccount: React.FC<NfcWrongAccountProps> = ({
  email,
  isSwitching,
  onSwitch,
}) => (
  <div className="space-y-3">
    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-900/20">
      <UserX className="h-6 w-6 shrink-0 text-amber-600" />
      <div className="text-sm">
        <p className="font-medium">Ponto não registado: esta sessão não é de colaborador</p>
        <p className="mt-1 text-muted-foreground">
          Está a usar a conta {email ? <strong>{email}</strong> : 'de administrador'}. O ponto só se
          regista com a conta de colaborador. Entre com ela e o registo desta tag é feito logo a
          seguir.
        </p>
      </div>
    </div>
    <Button variant="gold" className="w-full" disabled={isSwitching} onClick={onSwitch}>
      {isSwitching ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <LogIn className="h-4 w-4 mr-2" />
      )}
      Entrar como colaborador
    </Button>
  </div>
);
