import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DomainData {
  id?: string;
  domain_name: string;
  renewal_value: number;
  creation_date: string;
  last_paid_year?: number;
}

interface DomainModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain?: DomainData | null;
  onSave: () => void;
}

export function DomainModal({ open, onOpenChange, domain, onSave }: DomainModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<DomainData>({
    domain_name: "",
    renewal_value: 0,
    creation_date: "",
  });

  useEffect(() => {
    if (domain) {
      setFormData({ ...domain });
    } else {
      setFormData({
        domain_name: "",
        renewal_value: 0,
        creation_date: "",
      });
    }
  }, [domain, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!formData.domain_name || !formData.creation_date) {
        throw new Error("Por favor preencha todos os campos obrigatórios.");
      }

      if (formData.id) {
        // Update
        const { error } = await supabase
          .from("site_domains")
          .update({
            domain_name: formData.domain_name,
            renewal_value: formData.renewal_value,
            creation_date: formData.creation_date,
          })
          .eq("id", formData.id);

        if (error) throw error;
        toast({ title: "Domínio atualizado com sucesso!" });
      } else {
        // Insert
        const { error } = await supabase
          .from("site_domains")
          .insert([
            {
              domain_name: formData.domain_name,
              renewal_value: formData.renewal_value,
              creation_date: formData.creation_date,
            },
          ]);

        if (error) throw error;
        toast({ title: "Domínio adicionado com sucesso!" });
      }

      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao guardar",
        description: error.message || "Ocorreu um erro ao guardar o domínio.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{formData.id ? "Editar Domínio" : "Adicionar Domínio"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="domain_name">Nome do Domínio *</Label>
            <Input
              id="domain_name"
              placeholder="ex: realizesolucoes.pt"
              value={formData.domain_name}
              onChange={(e) => setFormData({ ...formData, domain_name: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="renewal_value">Valor da Renovação (€) *</Label>
            <Input
              id="renewal_value"
              type="number"
              step="0.01"
              value={formData.renewal_value}
              onChange={(e) => setFormData({ ...formData, renewal_value: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="creation_date">Data de Criação *</Label>
            <Input
              id="creation_date"
              type="date"
              value={formData.creation_date}
              onChange={(e) => setFormData({ ...formData, creation_date: e.target.value })}
              required
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
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
