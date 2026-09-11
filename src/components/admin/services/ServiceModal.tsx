import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { BillingCycle, ServiceType } from '@/lib/recurring-services';

export interface ServiceData {
  id?: string;
  service_type: ServiceType;
  name: string;
  provider: string | null;
  company_id: string | null;
  /** Morada da instalação. Só usada quando service_type é 'internet'. */
  location: string | null;
  amount: number;
  billing_cycle: BillingCycle;
  /** Data da próxima renovação (YYYY-MM-DD). Avança um período quando é marcado como pago. */
  renewal_date: string;
  last_paid_date?: string | null;
  /** Fim do período de fidelização (YYYY-MM-DD). Só usada quando service_type é 'internet'. */
  fidelity_end: string | null;
  notes: string | null;
  companies?: { name: string } | null;
}

interface Company {
  id: string;
  name: string;
}

interface ServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: ServiceData | null;
  companies: Company[];
  onSave: () => void;
}

const emptyForm: ServiceData = {
  service_type: 'internet',
  name: '',
  provider: '',
  company_id: null,
  location: '',
  amount: 0,
  billing_cycle: 'monthly',
  renewal_date: '',
  fidelity_end: null,
  notes: '',
};

export function ServiceModal({
  open,
  onOpenChange,
  service,
  companies,
  onSave,
}: ServiceModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ServiceData>(emptyForm);

  useEffect(() => {
    setFormData(service ? { ...service } : emptyForm);
  }, [service, open]);

  const isInternet = formData.service_type === 'internet';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!formData.name || !formData.renewal_date) {
        throw new Error('Por favor preencha todos os campos obrigatórios.');
      }

      // Morada e fidelização só fazem sentido em instalações de internet: se o tipo for
      // mudado para assinatura, os valores antigos são limpos em vez de ficarem órfãos.
      const payload = {
        service_type: formData.service_type,
        name: formData.name,
        provider: formData.provider || null,
        company_id: formData.company_id || null,
        location: isInternet ? formData.location || null : null,
        amount: formData.amount,
        billing_cycle: formData.billing_cycle,
        renewal_date: formData.renewal_date,
        fidelity_end: isInternet ? formData.fidelity_end || null : null,
        notes: formData.notes || null,
      };

      if (formData.id) {
        const { error } = await supabase
          .from('recurring_services')
          .update(payload)
          .eq('id', formData.id);

        if (error) throw error;
        toast({ title: 'Serviço atualizado com sucesso!' });
      } else {
        const { error } = await supabase.from('recurring_services').insert([payload]);

        if (error) throw error;
        toast({ title: 'Serviço adicionado com sucesso!' });
      }

      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao guardar',
        description: error.message || 'Ocorreu um erro ao guardar o serviço.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{formData.id ? 'Editar Serviço' : 'Adicionar Serviço'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service_type">Tipo *</Label>
              <Select
                value={formData.service_type}
                onValueChange={(value: ServiceType) =>
                  setFormData({ ...formData, service_type: value })
                }
              >
                <SelectTrigger id="service_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internet">Internet</SelectItem>
                  <SelectItem value="subscription">Assinatura</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing_cycle">Ciclo *</Label>
              <Select
                value={formData.billing_cycle}
                onValueChange={(value: BillingCycle) =>
                  setFormData({ ...formData, billing_cycle: value })
                }
              >
                <SelectTrigger id="billing_cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Designação *</Label>
            <Input
              id="name"
              placeholder={isInternet ? 'ex: Fibra 1Gb — Escritório' : 'ex: Microsoft 365 Business'}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">{isInternet ? 'Operadora' : 'Fornecedor'}</Label>
            <Input
              id="provider"
              placeholder={isInternet ? 'ex: NOS' : 'ex: Microsoft'}
              value={formData.provider ?? ''}
              onChange={e => setFormData({ ...formData, provider: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_id">Empresa</Label>
            <Select
              value={formData.company_id ?? 'none'}
              onValueChange={value =>
                setFormData({ ...formData, company_id: value === 'none' ? null : value })
              }
            >
              <SelectTrigger id="company_id">
                <SelectValue placeholder="Selecionar empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem empresa</SelectItem>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isInternet && (
            <div className="space-y-2">
              <Label htmlFor="location">Morada da Instalação</Label>
              <Input
                id="location"
                placeholder="ex: Rua Central 12, Porto"
                value={formData.location ?? ''}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (€) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={e =>
                  setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="renewal_date">Próxima Renovação *</Label>
              <Input
                id="renewal_date"
                type="date"
                value={formData.renewal_date}
                onChange={e => setFormData({ ...formData, renewal_date: e.target.value })}
                required
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A data do próximo pagamento. Ao marcar como pago, avança automaticamente{' '}
            {formData.billing_cycle === 'monthly' ? 'um mês' : 'um ano'}.
          </p>

          {isInternet && (
            <div className="space-y-2">
              <Label htmlFor="fidelity_end">Fim de Fidelização</Label>
              <Input
                id="fidelity_end"
                type="date"
                value={formData.fidelity_end ?? ''}
                onChange={e => setFormData({ ...formData, fidelity_end: e.target.value || null })}
              />
              <p className="text-xs text-muted-foreground">
                Opcional. Aparece um aviso 60 dias antes, para dar tempo de renegociar.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              rows={3}
              value={formData.notes ?? ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
