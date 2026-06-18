import { useState } from 'react';
import { Mail, Trash2, ShieldCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo-realize.png';

const DeleteAccountPage = () => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    const subject = encodeURIComponent('Pedido de Eliminação de Conta - Realize Portal');
    const body = encodeURIComponent(
      `Nome: ${name}\nEmail: ${email}\n\nMotivo (opcional):\n${reason}\n\n---\nPedido enviado a partir de realize.dasprent.pt/eliminar-conta`
    );
    window.location.href = `mailto:geral@realize.pt?subject=${subject}&body=${body}`;
    setSubmitted(true);
    toast({
      title: 'Pedido preparado',
      description: 'O seu cliente de email foi aberto. Envie o email para concluir o pedido.',
    });
  };

  return (
    <div className="min-h-screen bg-secondary flex flex-col">
      {/* Header simples */}
      <header className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logo} alt="Realize Consultadoria" className="h-10 w-auto" />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
        <div className="flex items-center gap-3 mb-2">
          <Trash2 className="h-7 w-7 text-destructive" />
          <h1 className="font-display text-3xl font-semibold">Eliminar Conta</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Pode solicitar a eliminação da sua conta e de todos os dados associados a qualquer
          momento.
        </p>

        {/* Info cards */}
        <div className="grid gap-4 mb-8">
          <div className="bg-background rounded-xl p-4 border border-border flex gap-3">
            <ShieldCheck className="h-5 w-5 text-gold shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">O que será eliminado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Dados pessoais (nome, email, telefone, IBAN, documentos), histórico de ausências e
                férias, documentos carregados, tickets de suporte e todas as informações associadas
                à sua conta.
              </p>
            </div>
          </div>
          <div className="bg-background rounded-xl p-4 border border-border flex gap-3">
            <Clock className="h-5 w-5 text-gold shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Prazo de processamento</p>
              <p className="text-sm text-muted-foreground mt-1">
                O pedido será processado no prazo de <strong>30 dias úteis</strong>. Receberá uma
                confirmação por email quando a eliminação estiver concluída. Alguns dados poderão
                ser retidos por obrigação legal (ex.: dados fiscais).
              </p>
            </div>
          </div>
          <div className="bg-background rounded-xl p-4 border border-border flex gap-3">
            <Mail className="h-5 w-5 text-gold shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Como funciona</p>
              <p className="text-sm text-muted-foreground mt-1">
                Preencha o formulário abaixo. Será aberto o seu email com a mensagem pré-preenchida
                — basta enviar. A nossa equipa irá verificar a identidade e proceder à eliminação.
              </p>
            </div>
          </div>
        </div>

        {/* Formulário */}
        {!submitted ? (
          <div className="bg-background rounded-xl border border-border p-6">
            <h2 className="font-display text-xl font-semibold mb-4">Formulário de Pedido</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Nome completo <span className="text-destructive">*</span>
                </label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="O seu nome completo"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Email da conta <span className="text-destructive">*</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Motivo (opcional)</label>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Pode indicar o motivo do pedido (opcional)"
                  rows={3}
                />
              </div>
              <Button type="submit" variant="destructive" className="w-full h-11">
                <Trash2 className="h-4 w-4 mr-2" />
                Solicitar Eliminação de Conta
              </Button>
            </form>
          </div>
        ) : (
          <div className="bg-background rounded-xl border border-border p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="font-semibold text-lg mb-2">Pedido preparado</h2>
            <p className="text-muted-foreground text-sm">
              O seu cliente de email foi aberto com a mensagem pré-preenchida. Envie o email para
              concluir o pedido. Responderemos em até 30 dias úteis.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-6">
          Em alternativa, pode enviar o pedido diretamente para{' '}
          <a href="mailto:geral@realize.pt" className="underline">
            geral@realize.pt
          </a>{' '}
          com o assunto "Eliminação de Conta".
        </p>
      </main>
    </div>
  );
};

export default DeleteAccountPage;
