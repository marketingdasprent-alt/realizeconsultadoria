import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Search, Edit, Scale, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import LegalAgenda from "@/components/admin/legal/LegalAgenda";
import LegalClientModal, { LegalClient } from "@/components/admin/legal/LegalClientModal";

const LegalPage = () => {
  const { toast } = useToast();
  const [clients, setClients] = useState<LegalClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<LegalClient | null>(null);
  const [listDialogType, setListDialogType] = useState<"arrears" | "owed" | "paid" | null>(null);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('legal_clients')
        .select(`*, legal_installments(*)`)
        .neq('status', 'Arquivado')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching legal_clients:', error);
        return;
      }
      
      const dataWithNumbers = (data || [])
        .map((client, index) => ({
          ...client,
          client_number: index + 1
        }));
      
      setClients(dataWithNumbers.reverse());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const hasTriggeredToasts = useRef(false);

  useEffect(() => {
    if (clients.length === 0 || isLoading || hasTriggeredToasts.current) return;
    
    let delayedClientsCount = 0;
    let todayClientsCount = 0;
    let expiringClientsCount = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    
    const inTwoDays = new Date(today);
    inTwoDays.setDate(today.getDate() + 2);
    const inTwoDaysTime = inTwoDays.getTime();

    clients.forEach(c => {
      if (c.status === 'Resolvido' || c.status === 'Inativo') return;

      let hasDelayed = false;
      let hasToday = false;
      let hasExpiring = false;

      const categorizeDate = (dateString: string) => {
        // Parse date carefully
        const [year, month, day] = dateString.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        const time = d.getTime();
        
        if (time < todayTime) hasDelayed = true;
        else if (time === todayTime) hasToday = true;
        else if (time > todayTime && time <= inTwoDaysTime) hasExpiring = true;
      };

      if (c.legal_installments && c.legal_installments.length > 0) {
        c.legal_installments.forEach((inst: any) => {
          if (inst.status === 'Pendente' && inst.due_date) {
            categorizeDate(inst.due_date);
          }
        });
      } 
      
      if (!hasDelayed && c.deadline_date) {
        const lit = Number(c.litigation_value) || 0;
        const paidSum = c.legal_installments?.filter((inst: any) => inst.status === 'Pago')
          .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0) || 0;
        
        if (lit - paidSum > 0) {
          categorizeDate(c.deadline_date);
        }
      }

      if (hasDelayed) delayedClientsCount++;
      if (hasToday) todayClientsCount++;
      if (hasExpiring) expiringClientsCount++;
    });

    const pendingToasts: any[] = [];

    if (delayedClientsCount > 0) {
      pendingToasts.push({
        title: "Pagamentos em Atraso",
        description: `Existem ${delayedClientsCount} cliente(s) com pagamentos já em atraso.`,
        variant: "destructive",
      });
    }

    if (todayClientsCount > 0) {
      pendingToasts.push({
        title: "Pagamentos para Hoje",
        description: `Existem ${todayClientsCount} cliente(s) com pagamentos a vencer no dia de hoje.`,
        variant: "destructive",
      });
    }
    
    if (expiringClientsCount > 0) {
      pendingToasts.push({
        title: "Pagamentos a Expirar Brevemente",
        description: `Existem ${expiringClientsCount} cliente(s) com pagamentos a vencer nos próximos 2 dias.`,
        className: "bg-yellow-500 text-white border-yellow-600",
      });
    }

    if (pendingToasts.length === 0) return;
    hasTriggeredToasts.current = true;

    // Execute sequentially with async/await equivalent
    const playToasts = async () => {
      for (let i = 0; i < pendingToasts.length; i++) {
        toast({ ...pendingToasts[i], duration: 3000 });
        // Wait 3000ms for duration + 500ms for buffer
        await new Promise(resolve => setTimeout(resolve, 3500));
      }
    };

    playToasts();

  }, [clients, isLoading, toast]);

  const handleOpenModal = (client: LegalClient | null = null) => {
    setSelectedClient(client);
    setIsModalOpen(true);
  };

  const handleDelete = (clientId: string) => {
    // No longer needs local filtering as fetchClients handles it via 'Arquivado' status
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'Resolvido':
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800";
      case 'Inativo':
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800";
      case 'Ativo':
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.nif && client.nif.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const paidDetails = useMemo(() => {
    const details: { client: LegalClient; clientName: string; amount: number; dates: string }[] = [];
    clients.forEach(c => {
      let paidSum = 0;
      let paidDatesText = '';

      if (c.status === 'Resolvido') {
        paidSum = Number(c.litigation_value) || 0;
        paidDatesText = 'Resolvido';
      } else {
        const paidInsts = c.legal_installments?.filter((inst: any) => inst.status === 'Pago') || [];
        paidSum = paidInsts.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
        paidDatesText = paidInsts.filter((i: any) => i.due_date).map((i: any) => {
          const [y, m, d] = i.due_date.split('-');
          return `${d}/${m}/${y}`;
        }).join(', ');
      }

      if (paidSum > 0) {
        details.push({
          client: c,
          clientName: c.name,
          amount: paidSum,
          dates: paidDatesText || 'Sem Registo'
        });
      }
    });
    return details;
  }, [clients]);

  const totalPagos = paidDetails.reduce((sum, item) => sum + item.amount, 0);

  const owedDetails = useMemo(() => {
    const details: { client: LegalClient; clientName: string; amount: number; dates: string }[] = [];
    clients.forEach(c => {
      if (c.status === 'Resolvido' || c.status === 'Inativo') return;
      const lit = Number(c.litigation_value) || 0;
      const installments = c.legal_installments || [];
      
      const paidSum = installments.filter((inst: any) => inst.status === 'Pago')
        .reduce((s, i) => s + (Number(i.amount) || 0), 0) || 0;
      const remaining = Math.max(0, lit - paidSum);
      
      if (remaining > 0) {
        const pendingInsts = installments.filter((i: any) => i.status === 'Pendente');
        let datesText = pendingInsts.filter((i: any) => i.due_date).map((i: any) => {
          const [y, m, d] = i.due_date.split('-');
          return `${d}/${m}/${y}`;
        }).join(', ');
        
        if (!datesText && c.deadline_date) {
           const [y, m, d] = c.deadline_date.split('-');
           datesText = `${d}/${m}/${y}`;
        }
        
        details.push({
          client: c,
          clientName: c.name,
          amount: remaining,
          dates: datesText || 'Sem Data Definida'
        });
      }
    });
    return details;
  }, [clients]);

  const totalADever = owedDetails.reduce((sum, item) => sum + item.amount, 0);

  const arrearsDetails = useMemo(() => {
    const details: { client: LegalClient; clientName: string; amount: number; dates: string }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    clients.forEach(c => {
      if (c.status === 'Resolvido' || c.status === 'Inativo') return;

      let isDelayed = false;
      let delayedAmount = 0;
      let lateDates: string[] = [];

      let deadlinePassed = false;
      if (c.deadline_date) {
        const [y, m, d] = c.deadline_date.split('-').map(Number);
        const deadlineDate = new Date(y, m - 1, d);
        if (deadlineDate.getTime() < todayTime) {
          deadlinePassed = true;
        }
      }

      const lit = Number(c.litigation_value) || 0;
      const paidSum = c.legal_installments?.filter((inst: any) => inst.status === 'Pago')
        .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0) || 0;
      const remaining = Math.max(0, lit - paidSum);

      if (deadlinePassed && remaining > 0) {
        isDelayed = true;
        delayedAmount = remaining;
        const [y, m, d] = c.deadline_date!.split('-');
        lateDates.push(`${d}/${m}/${y}`);
      } else {
        const delayedParcels = c.legal_installments?.filter((inst: any) => {
          if (inst.status !== 'Pendente' || !inst.due_date) return false;
          const [y, m, d] = inst.due_date.split('-').map(Number);
          const dueDate = new Date(y, m - 1, d);
          return dueDate.getTime() < todayTime;
        }) || [];

        if (delayedParcels.length > 0) {
          isDelayed = true;
          delayedAmount = delayedParcels.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
          lateDates = delayedParcels.map((i: any) => {
            const [y, m, d] = i.due_date.split('-');
            return `${d}/${m}/${y}`;
          });
        }
      }

      if (isDelayed && delayedAmount > 0) {
        details.push({
          client: c,
          clientName: c.name,
          amount: delayedAmount,
          dates: lateDates.join(', ')
        });
      }
    });
    return details;
  }, [clients]);

  const totalEmAtraso = arrearsDetails.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold">
              Jurídico
            </h1>
          </div>
          <Button onClick={() => handleOpenModal()} variant="gold" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Cliente
          </Button>
        </div>

        {/* Dashboard Resumo Financeiro */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setListDialogType("paid")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">Valores Pagos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(totalPagos)}
              </div>
              <p className="text-xs text-muted-foreground">
                Resolvidos + Parcelas Pagas
              </p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setListDialogType("owed")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold w-full text-left">Valores a Dever</CardTitle>
              <AlertCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">
                {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(totalADever)}
              </div>
              <p className="text-xs text-muted-foreground">
                Dívida pendente
              </p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setListDialogType("arrears")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold w-full text-left">Valores em Atraso</CardTitle>
              <Clock className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-500">
                {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(totalEmAtraso)}
              </div>
              <p className="text-xs text-muted-foreground">
                Parcelas vencidas ou datas limites finais
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Agenda */}
        <LegalAgenda clients={clients} />

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Pesquisar por nome ou NIF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Nº</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tipo de Cliente</TableHead>
                  <TableHead className="text-right">Valor Contencioso</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center w-[80px]">Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Scale className="h-8 w-8 opacity-20" />
                        <p>Nenhum cliente contencioso encontrado.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => {
                    const lit = Number(client.litigation_value) || 0;
                    const installments = client.legal_installments || [];
                    const paidSum = installments.filter((inst: any) => inst.status === 'Pago')
                      .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0) || 0;
                    const remainingValue = Math.max(0, lit - paidSum);
                    const isZero = remainingValue === 0;

                    return (
                      <TableRow 
                        key={client.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleOpenModal(client)}
                      >
                        <TableCell className="font-mono text-muted-foreground">#{client.client_number}</TableCell>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell className="font-mono text-sm">{client.nif || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{client.client_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800">
                            {client.litigation_type || "Contencioso"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${isZero ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-400'}`}>
                          {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(remainingValue)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={getStatusBadgeClasses(client.status)}>
                            {client.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Badge
                            className="cursor-pointer hover:bg-opacity-80 transition-colors"
                            variant="outline"
                            onClick={async () => {
                              const isPaid = client.status === 'Resolvido';
                              const newStatus = isPaid ? (client.litigation_type === 'Contencioso' ? 'Em análise' : 'Em contacto') : 'Resolvido';
                              
                              // Atualização otimista: atualiza a lista e cards na hora
                              setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: newStatus } : c));
                              
                              try {
                                const { error } = await supabase
                                  .from('legal_clients')
                                  .update({ status: newStatus })
                                  .eq('id', client.id);
                                  
                                if (error) throw error;
                                
                              } catch (err) {
                                // Reverte o estado visual em caso de erro da base de dados
                                setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: client.status } : c));
                                toast({ title: "Erro ao atualizar estado", variant: "destructive" });
                              }
                            }}
                            style={client.status === 'Resolvido' 
                              ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' } 
                              : { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }
                            }
                          >
                            {client.status === 'Resolvido' ? 'Pago' : 'Pendente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Modal */}
        <LegalClientModal 
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          client={selectedClient}
          onSave={fetchClients}
          onDelete={handleDelete}
        />

        {/* Short List Dialog */}
        <Dialog open={listDialogType !== null} onOpenChange={(open) => !open && setListDialogType(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl">
                {listDialogType === 'arrears' ? 'Detalhes: Valores em Atraso' : listDialogType === 'owed' ? 'Detalhes: Valores a Dever' : 'Detalhes: Valores Pagos'}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto pr-2 mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data(s)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(listDialogType === 'arrears' ? arrearsDetails : listDialogType === 'owed' ? owedDetails : paidDetails).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                        Nenhum registo encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (listDialogType === 'arrears' ? arrearsDetails : listDialogType === 'owed' ? owedDetails : paidDetails)
                      .sort((a, b) => b.amount - a.amount)
                      .map((item, i) => (
                        <TableRow 
                          key={i}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setListDialogType(null);
                            handleOpenModal(item.client);
                          }}
                        >
                          <TableCell className="font-medium whitespace-nowrap">
                            {item.clientName}
                          </TableCell>
                          <TableCell className={`font-bold whitespace-nowrap ${listDialogType === 'arrears' ? 'text-red-500' : listDialogType === 'owed' ? 'text-blue-500' : 'text-green-500'}`}>
                            {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(item.amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {item.dates.split(', ').map((dateStr, idx) => (
                                <Badge key={idx} variant="outline" className={`${listDialogType === 'arrears' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : listDialogType === 'owed' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'} border-transparent`}>
                                  {dateStr}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default LegalPage;
