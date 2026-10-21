import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { SwitchTarget } from '@/lib/account-switch';
import { accountSwitchService } from '../services/accountSwitchService';

/**
 * Botão "Ir para admin" / "Ir para Workspace": só para quem tem acesso à outra área (a própria
 * conta ou a conta ligada na ficha).
 */
export const useAccountSwitch = (current: SwitchTarget) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpening, setIsOpening] = useState(false);
  const other: SwitchTarget = current === 'admin' ? 'workspace' : 'admin';

  const { data: targets = [] } = useQuery({
    queryKey: ['auth', 'switch-targets', user?.id],
    queryFn: async () => (await accountSwitchService.targets()).data,
    enabled: !!user?.id,
    staleTime: 10 * 60_000,
  });

  const open = async () => {
    setIsOpening(true);
    const { error } = await accountSwitchService.open(other);
    // Com sucesso a página muda de endereço; só se volta aqui se falhou.
    if (error) {
      setIsOpening(false);
      toast({ title: error, variant: 'destructive' });
    }
  };

  return { other, canSwitch: targets.includes(other), isOpening, open };
};
