import { useState, useEffect } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Aviso {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

interface EmployeeAvisoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
}

export default function EmployeeAvisoDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
}: EmployeeAvisoDialogProps) {
  const { toast } = useToast();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [editingAviso, setEditingAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    if (open && employeeId) {
      fetchAvisos();
    }
  }, [open, employeeId]);

  const fetchAvisos = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, is_active, created_at')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar avisos:', error);
    } else {
      setAvisos(data || []);
    }
    setIsLoading(false);
  };

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) {
      toast({
        title: 'Erro',
        description: 'Preencha o título e a mensagem.',
        variant: 'destructive',
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('notifications').insert({
      employee_id: employeeId,
      company_id: null,
      title: title.trim(),
      message: message.trim(),
      created_by: user.id,
      is_active: true,
    });

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Aviso criado com sucesso!' });
      setTitle('');
      setMessage('');
      fetchAvisos();
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      fetchAvisos();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza que deseja eliminar este aviso?')) return;

    const { error } = await supabase.from('notifications').delete().eq('id', id);

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Aviso eliminado!' });
      fetchAvisos();
    }
  };

  const handleStartEdit = (aviso: Aviso) => {
    setEditingAviso(aviso);
    setTitle(aviso.title);
    setMessage(aviso.message);
  };

  const handleCancelEdit = () => {
    setEditingAviso(null);
    setTitle('');
    setMessage('');
  };

  const handleUpdate = async () => {
    if (!editingAviso) return;

    if (!title.trim() || !message.trim()) {
      toast({
        title: 'Erro',
        description: 'Preencha o título e a mensagem.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .update({
        title: title.trim(),
        message: message.trim(),
      })
      .eq('id', editingAviso.id);

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Aviso atualizado com sucesso!' });
      setEditingAviso(null);
      setTitle('');
      setMessage('');
      fetchAvisos();
    }
  };

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      setEditingAviso(null);
      setTitle('');
      setMessage('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Avisos de {employeeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Create/Edit notice form */}
          <div className="space-y-3 p-4 border border-border rounded-lg bg-secondary/50">
            <h3 className="font-medium text-sm">
              {editingAviso ? 'Editar Aviso' : 'Criar Novo Aviso'}
            </h3>
            <Input
              placeholder="Título do aviso"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Mensagem do aviso"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              {editingAviso ? (
                <>
                  <Button variant="gold" size="sm" onClick={handleUpdate}>
                    <Check className="h-4 w-4 mr-2" />
                    Guardar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button variant="gold" size="sm" onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Aviso
                </Button>
              )}
            </div>
          </div>

          {/* List existing notices */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Avisos Existentes</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">A carregar...</p>
            ) : avisos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem avisos para este colaborador.
              </p>
            ) : (
              <div className="space-y-2">
                {avisos.map((aviso) => (
                  <div
                    key={aviso.id}
                    className={`p-3 border rounded-lg flex items-start justify-between gap-3 ${
                      aviso.is_active
                        ? 'border-amber-200 bg-amber-50/50'
                        : 'border-border bg-muted/50 opacity-60'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{aviso.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {aviso.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleStartEdit(aviso)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggle(aviso.id, aviso.is_active)}
                        title={aviso.is_active ? 'Desativar' : 'Ativar'}
                      >
                        {aviso.is_active ? (
                          <ToggleRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(aviso.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
