import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage, type NotificationEmail } from '@/lib/timeclock';
import { timeClockNotificationService } from '../../services/timeClockNotificationService';

interface ApprovalEmailsCardProps {
  canEdit: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Quem recebe email quando um registo fica a aguardar aprovação ou com alertas. */
export const ApprovalEmailsCard: React.FC<ApprovalEmailsCardProps> = ({ canEdit }) => {
  const { toast } = useToast();
  const [emails, setEmails] = useState<NotificationEmail[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await timeClockNotificationService.list();
    setEmails(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fail = (error: unknown) =>
    toast({
      title: 'Erro',
      description: getErrorMessage(error, 'Operação falhou'),
      variant: 'destructive',
    });

  const add = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      toast({ title: 'Email inválido', variant: 'destructive' });
      return;
    }
    if (emails.some(e => e.email === email)) {
      toast({ title: 'Este email já está na lista', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const { error } = await timeClockNotificationService.add(email);
    setIsSaving(false);
    if (error) return fail(error);
    setNewEmail('');
    load();
  };

  const toggle = async (entry: NotificationEmail, active: boolean) => {
    const { error } = await timeClockNotificationService.setActive(entry.id, active);
    if (error) return fail(error);
    setEmails(list => list.map(e => (e.id === entry.id ? { ...e, is_active: active } : e)));
  };

  const remove = async (entry: NotificationEmail) => {
    const { error } = await timeClockNotificationService.remove(entry.id);
    if (error) return fail(error);
    setEmails(list => list.filter(e => e.id !== entry.id));
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5 text-gold" /> Emails de aprovação
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Recebem um email sempre que alguém regista ponto fora do local de trabalho (a aguardar
          aprovação) ou com alertas.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : emails.length === 0 ? (
          <p className="text-sm text-amber-700">
            Ninguém na lista: os pedidos de aprovação não serão enviados por email.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {emails.map(entry => (
              <li key={entry.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span
                  className={`flex-1 ${entry.is_active ? '' : 'text-muted-foreground line-through'}`}
                >
                  {entry.email}
                </span>
                {canEdit && (
                  <>
                    <Switch
                      checked={entry.is_active}
                      onCheckedChange={v => toggle(entry, v)}
                      aria-label="Ativo"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(entry)}
                      aria-label={`Remover ${entry.email}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="rh@realize.pt"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
            />
            <Button onClick={add} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-1">Adicionar</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
