import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminForgotPasswordFormProps {
  initialEmail: string;
}

export const AdminForgotPasswordForm = ({ initialEmail }: AdminForgotPasswordFormProps) => {
  const { toast } = useToast();
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState(initialEmail);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    // TODO: Implementar recuperação de password real
    setTimeout(() => {
      setForgotPasswordLoading(false);
      toast({
        title: 'Em desenvolvimento',
        description: 'Funcionalidade de recuperação será implementada em breve.',
        variant: 'destructive',
      });
    }, 1000);
  };

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Recuperar Palavra-passe</h1>
      <p className="text-muted-foreground mb-8">
        Insira o seu email de administrador para receber um link de recuperação.
      </p>

      {forgotPasswordSent ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            Email enviado! Verifique sua caixa de correio.
          </p>
        </div>
      ) : (
        <form onSubmit={handleForgotPassword} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              placeholder="seu@email.com"
              value={forgotPasswordEmail}
              onChange={e => setForgotPasswordEmail(e.target.value)}
              disabled={forgotPasswordLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={forgotPasswordLoading}>
            {forgotPasswordLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar Email'
            )}
          </Button>
        </form>
      )}
    </>
  );
};
