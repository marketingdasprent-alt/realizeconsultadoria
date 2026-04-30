import { useState, useEffect } from "react";
import { Plus, Globe, Search, Trash2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { differenceInDays, format, parseISO } from "date-fns";
import { DomainModal, DomainData } from "@/components/admin/domains/DomainModal";
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

export default function DomainsTab() {
  const { toast } = useToast();
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainData | null>(null);
  
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null);

  const fetchDomains = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("site_domains")
        .select("*")
        .order("creation_date", { ascending: true });

      if (error) throw error;
      setDomains(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar domínios",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const handleDelete = async () => {
    if (!domainToDelete) return;

    try {
      const { error } = await supabase
        .from("site_domains")
        .delete()
        .eq("id", domainToDelete);

      if (error) throw error;

      toast({ title: "Domínio removido com sucesso!" });
      fetchDomains();
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDomainToDelete(null);
    }
  };

  const getCycleInfo = (domain: DomainData) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    const creation = parseISO(domain.creation_date);
    
    const targetYear = domain.last_paid_year ? domain.last_paid_year + 1 : currentYear;
    const targetAnniversary = new Date(targetYear, creation.getMonth(), creation.getDate());
    
    const daysUntil = differenceInDays(targetAnniversary, today);
    const isPaidThisYear = (domain.last_paid_year || 0) >= currentYear;

    let label = "Regular";
    let className = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";

    if (daysUntil < 0) {
      label = "Expirado";
      className = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    } else if (daysUntil <= 7) {
      label = `Renova em ${daysUntil} dias`;
      className = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    } else if (isPaidThisYear) {
      label = "Pago";
      className = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    }

    return { label, className, isPaidThisYear, targetAnniversary };
  };

  const handleTogglePaid = async (domain: DomainData, currentPaid: boolean) => {
    const currentYear = new Date().getFullYear();
    const newYear = currentPaid ? currentYear - 1 : currentYear;
    
    // Optimistic UI update
    setDomains(prev => prev.map(d => d.id === domain.id ? { ...d, last_paid_year: newYear } : d));
    
    try {
      const { error } = await supabase
        .from("site_domains")
        .update({ last_paid_year: newYear })
        .eq("id", domain.id);
        
      if (error) throw error;
      
      fetchDomains(true);
    } catch (error: any) {
      fetchDomains(true); // Revert on error
      toast({
        title: "Erro ao atualizar estado",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredDomains = domains.filter((domain) =>
    domain.domain_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-gold" />
            Gestão de Domínios
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Controle de datas de renovação e valores de domínios web.
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedDomain(null);
            setIsModalOpen(true);
          }}
          variant="gold"
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Domínio
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar domínio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
        </div>

        {/* Table Section */}
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-semibold">Domínio</TableHead>
                  <TableHead className="font-semibold text-center">Valor (€)</TableHead>
                  <TableHead className="font-semibold text-center">Criado a</TableHead>
                  <TableHead className="font-semibold text-center">Próxima Renovação</TableHead>
                  <TableHead className="font-semibold text-center">Estado</TableHead>
                  <TableHead className="font-semibold text-center">Pago</TableHead>
                  <TableHead className="font-semibold text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                        A carregar domínios...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredDomains.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground bg-muted/5">
                      Nenhum domínio encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDomains.map((domain) => {
                    const info = getCycleInfo(domain);
                    return (
                      <TableRow key={domain.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-foreground">
                          {domain.domain_name}
                        </TableCell>
                        <TableCell className="text-center">
                          {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(domain.renewal_value)}
                        </TableCell>
                        <TableCell className="text-center">
                          {format(parseISO(domain.creation_date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {format(info.targetAnniversary, 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${info.className}`}>
                            {info.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Badge
                              className="cursor-pointer hover:bg-opacity-80 transition-colors"
                              variant="outline"
                              onClick={() => handleTogglePaid(domain, info.isPaidThisYear)}
                              style={info.isPaidThisYear ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' } : { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}
                            >
                              {info.isPaidThisYear ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedDomain(domain);
                                setIsModalOpen(true);
                              }}
                              className="h-8 w-8 hover:text-gold hover:bg-gold/10"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDomainToDelete(domain.id!)}
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>

      <DomainModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        domain={selectedDomain}
        onSave={fetchDomains}
      />

      <AlertDialog open={!!domainToDelete} onOpenChange={() => setDomainToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar Domínio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja apagar este domínio? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sim, apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
