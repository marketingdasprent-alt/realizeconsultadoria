import { useState, useEffect } from "react";
import { format, addMonths } from "date-fns";
import { pt } from "date-fns/locale";
import { Loader2, CalendarIcon, Car, CreditCard, User, Building, MapPin, Phone, Mail, Trash2, Calculator, FileText, UploadCloud, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface LegalClient {
  id?: string;
  name: string;
  nif: string;
  litigation_value: number;
  description: string;
  client_type: string;
  status: string;
  address: string;
  postal_code: string;
  city: string;
  iban: string;
  id_type: string;
  id_number: string;
  id_validity: string | null;
  tvde_license_number: string;
  tvde_license_validity: string | null;
  phone: string;
  email: string;
  driver_license_number: string;
  driver_license_categories: string;
  driver_license_validity: string | null;
  total_credits: number;
  total_debits: number;
  company_id: string; // Add this
  client_number?: number;
  deadline_date: string | null;
  litigation_type: string;
}

interface LegalDocument {
  id: string;
  client_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  content_type: string;
  invoice_date: string;
  created_at: string;
}

interface PendingFile {
  file: File;
  invoice_date: string;
}

export interface LegalInstallment {
  id?: string;
  client_id?: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: string;
}

interface LegalClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: LegalClient | null;
  onSave: () => void;
  onDelete?: (id: string) => void;
}

const emptyClient: LegalClient = {
  name: "",
  nif: "",
  litigation_value: 0,
  description: "",
  client_type: "TVDE",
  status: "Ativo",
  address: "",
  postal_code: "",
  city: "",
  iban: "",
  id_type: "Cartão de Cidadão",
  id_number: "",
  id_validity: null,
  tvde_license_number: "",
  tvde_license_validity: null,
  phone: "",
  email: "",
  driver_license_number: "",
  driver_license_categories: "",
  driver_license_validity: null,
  total_credits: 0,
  total_debits: 0,
  company_id: "",
  deadline_date: null,
  litigation_type: "Pre Contencioso"
};

export default function LegalClientModal({ open, onOpenChange, client, onSave, onDelete }: LegalClientModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<LegalClient>(emptyClient);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companies, setCompanies] = useState<{ id: string, name: string }[]>([]);

  // Installments State
  const [hasAgreement, setHasAgreement] = useState(false);
  const [manualInstallment, setManualInstallment] = useState({ amount: 0, date: format(new Date(), 'yyyy-MM-dd') });
  const [installments, setInstallments] = useState<LegalInstallment[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Document states
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedInvoiceDate, setSelectedInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  useEffect(() => {
    if (open) {
      if (client) {
        setFormData({ ...client });
        fetchInstallments(client.id);
        fetchDocuments(client.id);
      } else {
        setFormData({ ...emptyClient });
        setHasAgreement(false);
        setInstallments([]);
        setDocuments([]);
        setPendingFiles([]);
      }
      fetchCompanies(client);
    }
  }, [open, client]);

  const fetchDocuments = async (clientId: string) => {
    if (!clientId) return;
    const { data, error } = await supabase
      .from('legal_client_documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching documents:", error);
      return;
    }
    setDocuments(data || []);
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!formData.id) {
      // If no ID yet, add to pending
      setPendingFiles(prev => [...prev, { file, invoice_date: selectedInvoiceDate }]);
      toast({ title: "Fatura anexada!", description: "Será guardada ao criar o cliente." });
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${formData.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('legal_documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('legal_client_documents')
        .insert([{
          client_id: formData.id,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          content_type: file.type,
          invoice_date: selectedInvoiceDate
        }]);

      if (dbError) throw dbError;

      toast({ title: "Documento enviado com sucesso!" });
      fetchDocuments(formData.id);
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleViewDocument = async (doc: LegalDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('legal_documents')
        .createSignedUrl(doc.file_path, 60 * 60); // 1 hour

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error("Error viewing document:", error);
      toast({
        title: "Erro ao abrir documento",
        variant: "destructive"
      });
    }
  };

  const handleDeleteDocument = async (doc: LegalDocument) => {
    try {
      const { error: storageError } = await supabase.storage
        .from('legal_documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('legal_client_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast({ title: "Documento removido" });
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Erro ao remover documento",
        variant: "destructive"
      });
    }
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const fetchInstallments = async (clientId: string) => {
    if (!clientId) return;
    const { data } = await supabase
      .from('legal_installments')
      .select('*')
      .eq('client_id', clientId)
      .order('installment_number', { ascending: true });

    if (data && data.length > 0) {
      setHasAgreement(true);
      setInstallments(data);
    } else {
      setHasAgreement(false);
      setInstallments([]);
    }
  };

  const getAvailableDebt = () => {
    const allocatedSum = installments.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    return Math.max(0, (Number(formData.litigation_value) || 0) - allocatedSum);
  };

  const handleAddManualInstallment = () => {
    if (!manualInstallment.date || manualInstallment.amount <= 0) return;

    const available = getAvailableDebt();
    if (manualInstallment.amount > available) {
      toast({ title: "Valor excede a dívida disponível", description: `Apenas tem ${available.toFixed(2)}€ disponíveis para novas parcelas.`, variant: "destructive", duration: 2500 });
      return;
    }

    const newInst = [...installments, {
      installment_number: 0,
      amount: manualInstallment.amount,
      due_date: manualInstallment.date,
      status: 'Pendente'
    }];

    newInst.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    newInst.forEach((inst, idx) => inst.installment_number = idx + 1);

    setInstallments(newInst);
    setManualInstallment({ amount: 0, date: manualInstallment.date });
  };

  const handleRemoveInstallment = (index: number) => {
    const newInst = [...installments];
    newInst.splice(index, 1);
    newInst.forEach((inst, idx) => inst.installment_number = idx + 1);
    setInstallments(newInst);
  };

  const toggleInstallmentStatus = (idx: number) => {
    const newInst = [...installments];
    const inst = newInst[idx];
    inst.status = inst.status === 'Pago' ? 'Pendente' : 'Pago';
    setInstallments(newInst);
  };

  const fetchCompanies = async (currentClient: LegalClient | null) => {
    const { data } = await supabase.from('companies').select('id, name');
    if (data) {
      setCompanies(data);
      // Only set to first company if we are creating a new client AND no company is selected yet.
      // We pass currentClient to avoid stale closure issues during the async effect.
      if (!currentClient && data.length > 0) {
        setFormData(prev => ({ 
          ...prev, 
          company_id: prev.company_id ? prev.company_id : data[0].id 
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!formData.company_id) throw new Error("A seleção da empresa é obrigatória.");

      // Check for duplicate NIF (if NIF is provided)
      if (formData.nif) {
        let query = supabase
          .from('legal_clients')
          .select('id')
          .eq('nif', formData.nif)
          .maybeSingle();

        const { data: existingClient } = await query;

        if (existingClient && existingClient.id !== formData.id) {
          toast({
            title: "Cliente já registado",
            description: `Já existe um cliente contencioso com o NIF ${formData.nif}.`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        name: formData.name,
        nif: formData.nif,
        litigation_value: formData.litigation_value,
        description: formData.description,
        client_type: formData.client_type,
        status: formData.status,
        address: formData.address,
        postal_code: formData.postal_code,
        city: formData.city,
        iban: formData.iban,
        id_type: formData.id_type,
        id_number: formData.id_number,
        id_validity: formData.id_validity,
        tvde_license_number: formData.tvde_license_number,
        tvde_license_validity: formData.tvde_license_validity,
        phone: formData.phone,
        email: formData.email,
        driver_license_number: formData.driver_license_number,
        driver_license_categories: formData.driver_license_categories,
        driver_license_validity: formData.driver_license_validity,
        total_credits: formData.total_credits,
        total_debits: formData.total_debits,
        company_id: formData.company_id,
        deadline_date: formData.deadline_date,
        litigation_type: formData.litigation_type,
      };

      let currentClientId = formData.id;

      if (currentClientId) {
        // Update
        const { error } = await supabase
          .from('legal_clients')
          .update(payload)
          .eq('id', currentClientId);
        if (error) throw error;
        toast({ title: "Cliente atualizado com sucesso!", duration: 500 });
      } else {
        // Insert
        const { data, error } = await supabase
          .from('legal_clients')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        currentClientId = data.id;
        toast({ title: "Cliente criado com sucesso!", duration: 500 });
      }

      // Handle Pending Files Upload
      if (pendingFiles.length > 0 && currentClientId) {
        for (const item of pendingFiles) {
          const fileExt = item.file.name.split('.').pop();
          const filePath = `${currentClientId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          await supabase.storage.from('legal_documents').upload(filePath, item.file);
          
          await supabase.from('legal_client_documents').insert([{
            client_id: currentClientId,
            file_path: filePath,
            file_name: item.file.name,
            file_size: item.file.size,
            content_type: item.file.type,
            invoice_date: item.invoice_date
          }]);
        }
        setPendingFiles([]);
      }

      // Handle Installments
      if (hasAgreement && currentClientId && installments.length > 0) {
        await supabase.from('legal_installments').delete().eq('client_id', currentClientId);
        const installmentsPayload = installments.map(inst => ({
          client_id: currentClientId,
          installment_number: inst.installment_number,
          amount: inst.amount,
          due_date: inst.due_date,
          status: inst.status
        }));
        await supabase.from('legal_installments').insert(installmentsPayload);
      } else if (!hasAgreement && currentClientId) {
        await supabase.from('legal_installments').delete().eq('client_id', currentClientId);
      }

      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erro ao guardar cliente",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const SectionHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
    <div className="flex items-center gap-2 mb-4 bg-muted/30 p-2 rounded-t-md font-medium border-b text-sm">
      <Icon className="h-4 w-4 opacity-70" /> {title}
    </div>
  );

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'Resolvido':
      case 'Acordo feito':
        return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400";
      case 'Inativo':
      case 'Notificado':
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400";
      case 'Ativo':
      case 'Em negociação':
        return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400";
      case 'Em contacto':
      case 'Em análise':
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400";
      case 'Em tribunal':
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400";
      case 'Decisão':
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const handleDelete = () => {
    if (!formData.id) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!formData.id) return;
    setIsSubmitting(true);
    try {
      if (formData.id && onDelete) {
        onDelete(formData.id);
      }

      console.log("Arquivando cliente ID:", formData.id);

      // Perform a 'Soft Delete' since the server blocks Hard Delete via RLS
      const { error } = await supabase
        .from('legal_clients')
        .update({ status: 'Arquivado' })
        .eq('id', formData.id);

      if (error) throw error;

      console.log("Cliente arquivado com sucesso na DB");

      toast({ title: "Cliente removido com sucesso!", duration: 500 });

      // Update local state before closing
      setFormData(emptyClient);
      setInstallments([]);

      await onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro crítico ao apagar cliente:", error);
      toast({
        title: "Erro ao apagar",
        description: error.message || "Não foi possível apagar o cliente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center text-2xl pb-4 border-b">
              <div className="flex items-center gap-4">
                {formData.name || "Novo Cliente Contencioso"}
                <Badge variant="outline" className={cn("font-medium text-[15px] px-3 py-0.5 mt-0.5 border-transparent", getStatusBadgeClasses(formData.status))}>
                  {formData.status}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          <form id="client-form" onSubmit={handleSubmit} className="space-y-6 pt-4">

            {/* Top basic info row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 bg-muted/10 p-5 rounded-md border shadow-sm">
              <div className="md:col-span-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome Completo *</label>
                <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="mt-1.5 bg-background shadow-xs text-sm" />
              </div>
              
              <div className="md:col-span-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa Associada *</label>
                <Select value={formData.company_id} onValueChange={(v) => setFormData({ ...formData, company_id: v })}>
                  <SelectTrigger className="mt-1.5 bg-background font-medium border-gold/40 focus:ring-gold/50 hover:border-gold/80 transition-colors shadow-xs truncate">
                    <SelectValue placeholder="Selecione empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de Cliente</label>
                <Select
                  value={formData.litigation_type}
                  onValueChange={(v) => {
                    const newStatus = v === "Pre Contencioso" ? "Em contacto" : "Em análise";
                    setFormData({ ...formData, litigation_type: v, status: newStatus });
                  }}
                >
                  <SelectTrigger className="mt-1.5 bg-background font-medium border-gold/40 focus:ring-gold/50 hover:border-gold/80 transition-colors shadow-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Contencioso">Contencioso</SelectItem>
                    <SelectItem value="Pre Contencioso">Pre Contencioso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="md:col-span-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="mt-1.5 bg-background border-gold/40 focus:ring-gold/50 hover:border-gold/80 transition-colors shadow-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.litigation_type === "Pre Contencioso" ? (
                      <>
                        <SelectItem value="Em contacto">Em contacto</SelectItem>
                        <SelectItem value="Notificado">Notificado</SelectItem>
                        <SelectItem value="Em negociação">Em negociação</SelectItem>
                        <SelectItem value="Acordo feito">Acordo feito</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="Em análise">Em análise</SelectItem>
                        <SelectItem value="Em tribunal">Em tribunal</SelectItem>
                        <SelectItem value="Decisão">Decisão</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* COLUNA 1 - Pessoal & Dinheiro */}
              <div className="flex flex-col gap-6">
                {/* DADOS PESSOAIS */}
                <div className="border rounded-md shadow-sm bg-card overflow-hidden flex flex-col">
                  <SectionHeader title="DADOS PESSOAIS" icon={User} />
                  <div className="p-4 space-y-3 flex flex-col">
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-muted-foreground w-1/3 text-left">NIF</span> <Input className="w-2/3 h-8 shadow-xs" value={formData.nif} onChange={e => setFormData({ ...formData, nif: e.target.value })} /></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-muted-foreground w-1/3 text-left">Morada</span> <Input className="w-2/3 h-8 shadow-xs" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-muted-foreground w-1/3 text-left">CP</span> <Input className="w-2/3 h-8 shadow-xs" value={formData.postal_code} onChange={e => setFormData({ ...formData, postal_code: e.target.value })} /></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-muted-foreground w-1/3 text-left">Cidade</span> <Input className="w-2/3 h-8 shadow-xs" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} /></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-muted-foreground w-1/3 text-left">IBAN</span> <Input className="w-2/3 h-8 shadow-xs" value={formData.iban} onChange={e => setFormData({ ...formData, iban: e.target.value })} /></div>
                  </div>
                </div>

                {/* VALOR EM CONTENCIOSO (STRETCHED TO ALIGN) */}
                <div className="border rounded-md shadow-sm bg-blue-50/40 overflow-hidden flex flex-col">
                  <SectionHeader title="VALOR EM CONTENCIOSO" icon={Calculator} />
                  <div className="p-4 flex flex-col items-center justify-center gap-5">
                    <div className="w-full flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700/80 dark:text-blue-400/80 uppercase tracking-wide">Quantia Total</span>
                      <div className="flex items-center bg-background rounded-md border border-blue-200 dark:border-blue-800 shadow-xs px-2 w-1/2">
                        <Input
                          type="number"
                          className="w-full text-right text-blue-700 dark:text-blue-400 font-bold border-none focus-visible:ring-0 bg-transparent h-9 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                          value={formData.litigation_value}
                          onChange={e => setFormData({ ...formData, litigation_value: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="ml-2 font-bold text-blue-700/80 dark:text-blue-400/80">€</span>
                      </div>
                    </div>

                    <div className="w-full flex items-center justify-between">
                      <label className="text-xs font-bold text-blue-700/80 dark:text-blue-400/80 uppercase tracking-wide">Data Limite</label>
                      <Input
                        type="date"
                        value={formData.deadline_date || ""}
                        onChange={e => setFormData({ ...formData, deadline_date: e.target.value })}
                        className="w-1/2 bg-background h-9 text-xs justify-center shadow-xs text-center p-2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUNA 2 */}
              <div className="flex flex-col gap-6">
                {/* IDENTIFICAÇÃO */}
                <div className="border rounded-md shadow-sm bg-card overflow-hidden flex flex-col">
                  <SectionHeader title="IDENTIFICAÇÃO" icon={CreditCard} />
                  <div className="p-4 space-y-3 flex flex-col">
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-muted-foreground w-1/3 text-left">Tipo</span>
                      <Select value={formData.id_type} onValueChange={(v) => setFormData({ ...formData, id_type: v })}>
                        <SelectTrigger className="w-2/3 h-8 shadow-xs [&>span]:flex-1 [&>span]:text-center border-gold/40 focus:ring-gold/50 hover:border-gold/80 transition-colors"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cartão de Cidadão">Cartão de Cidadão</SelectItem>
                          <SelectItem value="Passaporte">Passaporte</SelectItem>
                          <SelectItem value="Título de Residência">Título de Residência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-muted-foreground w-1/3 text-left">Número</span> <Input className="w-2/3 h-8 shadow-xs text-center" value={formData.id_number} onChange={e => setFormData({ ...formData, id_number: e.target.value })} /></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-muted-foreground w-1/3 text-left">Validade</span> <Input type="date" className="w-2/3 h-8 shadow-xs text-center" value={formData.id_validity || ""} onChange={e => setFormData({ ...formData, id_validity: e.target.value })} /></div>
                  </div>
                </div>

                {/* CARTA DE CONDUÇÃO */}
                <div className="border rounded-md shadow-sm bg-purple-50/40 overflow-hidden dark:bg-purple-950/20 flex flex-col">
                  <SectionHeader title="CARTA DE CONDUÇÃO" icon={Car} />
                  <div className="p-4 space-y-3 flex flex-col">
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-purple-700/80 dark:text-purple-400 w-1/3 text-left">Número</span> <Input className="w-2/3 h-8 shadow-xs border-purple-200 dark:border-purple-800 text-center" value={formData.driver_license_number} onChange={e => setFormData({ ...formData, driver_license_number: e.target.value })} /></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-purple-700/80 dark:text-purple-400 w-1/3 text-left">Categorias</span> <Input className="w-2/3 h-8 shadow-xs border-purple-200 dark:border-purple-800 text-center" value={formData.driver_license_categories} onChange={e => setFormData({ ...formData, driver_license_categories: e.target.value })} /></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-purple-700/80 dark:text-purple-400 w-1/3 text-left">Validade</span> <Input type="date" className="w-2/3 h-8 shadow-xs border-purple-200 dark:border-purple-800 text-center" value={formData.driver_license_validity || ""} onChange={e => setFormData({ ...formData, driver_license_validity: e.target.value })} /></div>
                  </div>
                </div>
              </div>

              {/* COLUNA 3 */}
              <div className="flex flex-col gap-6">
                {/* LICENÇA TVDE */}
                <div className="border border-green-200/50 rounded-md shadow-sm bg-green-50/40 overflow-hidden dark:bg-green-950/20 flex flex-col">
                  <SectionHeader title="LICENÇA TVDE" icon={FileText} />
                  <div className="p-4 space-y-3 flex flex-col pt-5">
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-green-700/80 dark:text-green-400 w-1/3 text-left">Nº Licença</span> <Input className="w-2/3 h-8 shadow-xs border-green-200 dark:border-green-800 text-center" value={formData.tvde_license_number} onChange={e => setFormData({ ...formData, tvde_license_number: e.target.value })} /></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-green-700/80 dark:text-green-400 w-1/3 text-left">Validade</span> <Input type="date" className="w-2/3 h-8 shadow-xs border-green-200 dark:border-green-800 text-center" value={formData.tvde_license_validity || ""} onChange={e => setFormData({ ...formData, tvde_license_validity: e.target.value })} /></div>
                  </div>
                </div>

                {/* CONTACTOS */}
                <div className="border border-green-200/50 rounded-md shadow-sm bg-green-50/20 overflow-hidden dark:bg-green-950/10 flex flex-col">
                  <SectionHeader title="CONTACTOS" icon={Phone} />
                  <div className="p-4 space-y-3 flex flex-col">
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-green-700/80 dark:text-green-400 w-1/3 text-left">Telefone</span> <Input className="w-2/3 h-8 shadow-xs border-green-200 dark:border-green-800 text-center" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-medium text-green-700/80 dark:text-green-400 w-1/3 text-left">Email</span> <Input type="email" className="w-2/3 h-8 shadow-xs border-green-200 dark:border-green-800 text-center" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                  </div>
                </div>
              </div>
            </div>

              {/* INFORMAÇÕES ADICIONAIS */}
              <div className="border rounded-md shadow-sm bg-card overflow-hidden md:col-span-3">
                <SectionHeader title="DESCRIÇÃO DO PROCESSO / NOTAS" icon={Mail} />
                <div className="p-0">
                  <Textarea
                    className="w-full min-h-[80px] border-0 focus-visible:ring-0 resize-none p-4 text-center text-sm"
                    placeholder="Escreva aqui a descrição do contencioso, notas importantes sobre o processo..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              {/* DOCUMENTOS / FATURAS */}
              <div className="border rounded-md shadow-sm bg-card overflow-hidden md:col-span-3">
                <div className="flex items-center justify-between gap-2 bg-muted/30 p-3 border-b font-medium text-xs uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 opacity-70" /> DOCUMENTOS / FATURAS
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-background border rounded px-2 py-0.5 border-gold/30">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">Data da Fatura:</span>
                      <input
                        type="date"
                        value={selectedInvoiceDate}
                        onChange={(e) => setSelectedInvoiceDate(e.target.value)}
                        className="bg-transparent border-none text-[10px] p-0 focus:ring-0 outline-none w-24 cursor-pointer"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type="file"
                        id="doc-upload"
                        className="hidden"
                        onChange={handleUploadDocument}
                        disabled={isUploading}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] bg-background hover:bg-gold/10 border-gold/30"
                        onClick={() => document.getElementById('doc-upload')?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UploadCloud className="h-3 w-3 mr-1" />}
                        ADICIONAR FATURA
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  {documents.length === 0 && pendingFiles.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded italic bg-muted/5">
                      Nenhum documento anexado a este cliente.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Real Documents */}
                      {documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/10 group hover:border-gold/30 hover:bg-background transition-all">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="h-8 w-8 rounded bg-gold/10 flex items-center justify-center shrink-0">
                              <FileText className="h-4 w-4 text-gold" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium truncate pr-2">{doc.file_name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(doc.invoice_date), 'dd/MM/yyyy')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-gold"
                              onClick={() => handleViewDocument(doc)}
                              title="Ver Documento"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-red-500"
                              onClick={() => handleDeleteDocument(doc)}
                              title="Remover"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Pending Files */}
                      {pendingFiles.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 border border-dashed rounded-lg bg-amber-50/30 dark:bg-amber-950/10 group hover:border-gold/40 transition-all">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="h-8 w-8 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                              <UploadCloud className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium truncate">{item.file.name}</span>
                                <Badge variant="secondary" className="h-3.5 text-[8px] px-1 bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">PENDENTE</Badge>
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(item.invoice_date), 'dd/MM/yyyy')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-red-500"
                              onClick={() => handleRemovePendingFile(idx)}
                              title="Cancelar Anexo"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ACORDOS DE PAGAMENTO */}
              <div className="border rounded-md shadow-sm bg-card overflow-hidden md:col-span-3 mt-4">
                <div className="flex items-center justify-between gap-2 bg-muted/30 p-4 border-b font-medium text-sm">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 opacity-70" /> ACORDOS DE PAGAMENTO
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-normal">Tem Acordo Ativo?</span>
                    <Switch checked={hasAgreement} onCheckedChange={setHasAgreement} />
                  </div>
                </div>

                {hasAgreement && (
                  <div className="p-4 space-y-6 bg-muted/5">
                    <div className="flex justify-between items-center bg-blue-50/50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
                      <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Dívida Disponível para Acordo:</span>
                      <span className="text-lg font-bold text-blue-800 dark:text-blue-300">
                        {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(getAvailableDebt())}
                      </span>
                    </div>

                    <div className="bg-background p-4 rounded border space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground w-full block text-center mb-1">Valor da Parcela (€)</label>
                          <Input type="number" className="text-center" value={manualInstallment.amount || ""} onChange={e => setManualInstallment({ ...manualInstallment, amount: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground w-full block text-center mb-1">Data de Vencimento</label>
                          <Input type="date" className="text-center flex justify-center [&::-webkit-datetime-edit]:justify-center [&::-webkit-datetime-edit]:flex" value={manualInstallment.date} onChange={e => setManualInstallment({ ...manualInstallment, date: e.target.value })} />
                        </div>
                        <Button type="button" onClick={handleAddManualInstallment} variant="outline" className="w-full">
                          Adicionar Parcela
                        </Button>
                      </div>
                    </div>

                    {/* List / Table */}
                    {installments.length > 0 && (
                      <div className="border rounded overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-muted text-xs uppercase text-muted-foreground">
                            <tr>
                              <th className="px-4 py-2">Nº Parcela</th>
                              <th className="px-4 py-2 text-center">Valor</th>
                              <th className="px-4 py-2 text-center">Data Vencimento</th>
                              <th className="px-4 py-2 text-center">Estado</th>
                              <th className="px-4 py-2 text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y bg-background">
                            {installments.map((inst, idx) => (
                              <tr key={idx} className="hover:bg-muted/50 transition-colors">
                                <td className="px-4 py-2 font-medium">Parcela {inst.installment_number}</td>
                                <td className="px-4 py-2 text-center">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(inst.amount)}</td>
                                <td className="px-4 py-2 text-center">{format(new Date(inst.due_date), 'dd/MM/yyyy')}</td>
                                <td className="px-4 py-2 text-center">
                                  <Badge
                                    className="cursor-pointer hover:bg-opacity-80"
                                    variant="outline"
                                    onClick={() => toggleInstallmentStatus(idx)}
                                    style={inst.status === 'Pago' ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' } : { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}
                                  >
                                    {inst.status}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {inst.status === 'Pendente' && (
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleRemoveInstallment(idx)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {installments.length === 0 && (
                      <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded">
                        Preencha os dados e clique em "Adicionar Parcela" para iniciar um plano de pagamento.
                      </div>
                    )}
                  </div>
                )}
              </div>
          </form>

          <DialogFooter className="mt-4 pt-4 border-t flex flex-col sm:flex-row sm:justify-between items-center gap-4">
            <div className="w-full sm:w-auto">
              {formData.id && (
                <Button type="button" variant="destructive" onClick={handleDelete} className="w-full sm:w-auto" disabled={isSubmitting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Apagar Cliente
                </Button>
              )}
            </div>
            <div className="flex w-full sm:w-auto gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button form="client-form" type="submit" variant="gold" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                ) : (
                  formData.id ? "Guardar Alterações" : "Criar Cliente"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem a certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isto irá apagar permanentemente o cliente
              <span className="font-semibold text-foreground mx-1">"{formData.name}"</span>
              e todos os dados associados dos nossos servidores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "A apagar..." : "Apagar Cliente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
