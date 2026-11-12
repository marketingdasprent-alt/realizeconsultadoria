import React, { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { ConnectMailDialog } from '@/modules/webmail/components/ConnectMailDialog';
import { ProviderGrid } from '@/modules/webmail/components/ProviderGrid';
import type { MailProvider } from '@/modules/webmail/lib/providers';
import { mailAppLoginImap, mailAppLoginMicrosoft } from '@/modules/webmail/services/mailAppLogin';

/**
 * Entrar na app de email: escolher o fornecedor e entrar com a própria caixa (IMAP com a
 * palavra-passe dela, ou Microsoft). Não há conta para criar — a caixa é a conta.
 */
export const MailLoginPage: React.FC = () => {
  const [provider, setProvider] = useState<MailProvider | null>(null);

  const fail = (message: string) =>
    toast({ title: 'Não foi possível entrar', description: message, variant: 'destructive' });

  return (
    <div className="h-[100dvh]">
      <ProviderGrid onPick={setProvider} />
      <ConnectMailDialog
        provider={provider}
        onClose={() => setProvider(null)}
        onSwitch={setProvider}
        onOAuth={async picked => {
          const error = await mailAppLoginMicrosoft(picked.key);
          if (error) fail(error);
        }}
        onImap={async input => {
          const error = await mailAppLoginImap(input);
          if (error) {
            fail(error);
            return false;
          }
          return true;
        }}
      />
    </div>
  );
};
