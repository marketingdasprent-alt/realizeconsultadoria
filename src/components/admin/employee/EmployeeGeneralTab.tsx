import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, addMonths, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { Loader2, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  department: string | null;
  company_id: string;
  is_active: boolean;
  nationality: string | null;
  document_number: string | null;
  iban: string | null;
  cartao_da: string | null;
  cartao_refeicao: string | null;
  safety_checkup_date: string | null;
  safety_checkup_renewal_months: number | null;
}

interface Company {
  id: string;
  name: string;
}

interface EmployeeGeneralTabProps {
  employee: Employee | null;
  companies: Company[];
  isEditMode: boolean;
  onSaved: () => void;
  onCreated: (employeeId: string) => void;
}

const EmployeeGeneralTab = ({
  employee,
  companies,
  isEditMode,
  onSaved,
  onCreated,
}: EmployeeGeneralTabProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentYear = new Date().getFullYear();
  const originalEmail = employee?.email || "";

  const [formData, setFormData] = useState({
    name: employee?.name || "",
    email: employee?.email || "",
    phone: employee?.phone || "",
    position: employee?.position || "",
    department: employee?.department || "",
    company_id: employee?.company_id || "",
    nationality: employee?.nationality || "",
    document_number: employee?.document_number || "",
    password: "",
    confirmPassword: "",
    vacation_days: "22",
    self_schedulable_days: "",
    iban: employee?.iban || "",
    cartao_da: employee?.cartao_da || "",
    cartao_refeicao: employee?.cartao_refeicao || "",
    safety_checkup_date: employee?.safety_checkup_date
      ? parseISO(employee.safety_checkup_date)
      : null as Date | null,
    safety_checkup_renewal_months: employee?.safety_checkup_renewal_months?.toString() || "12",
  });

  // Calculate next renewal date
  const nextRenewalDate = formData.safety_checkup_date && formData.safety_checkup_renewal_months
    ? addMonths(formData.safety_checkup_date, parseInt(formData.safety_checkup_renewal_months) || 12)
    : null;

  const emailChanged = isEditMode && formData.email.toLowerCase().trim() !== originalEmail.toLowerCase().trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isEditMode && employee) {
        // Check if email changed - password is optional
      if (emailChanged) {
          // Call edge function to update email
          const { data, error: emailError } = await supabase.functions.invoke('update-employee-email', {
            body: {
              employee_id: employee.id,
              new_email: formData.email.toLowerCase().trim(),
            }
          });

          if (emailError) {
            // Try to extract the JSON error from the function response (when available)
            let description = (emailError as any)?.message ?? "Erro ao atualizar email.";
            const response = (emailError as any)?.context?.response as Response | undefined;
            if (response) {
              try {
                const json = await response.clone().json();
                if (json?.error && typeof json.error === "string") {
                  description = json.error;
                }
              } catch {
                // ignore parsing errors
              }
            }

            toast({
              title: "Erro",
              description,
              variant: "destructive",
            });

            setIsSubmitting(false);
            return;
          }
          if (data?.error) {
            toast({
              title: "Erro",
              description: data.error,
              variant: "destructive",
            });
            setIsSubmitting(false);
            return;
          }

          // Update other fields
          const { error } = await supabase
            .from('employees')
            .update({
              name: formData.name,
              phone: formData.phone || null,
              position: formData.position || null,
              department: formData.department || null,
              company_id: formData.company_id,
              nationality: formData.nationality || null,
              document_number: formData.document_number || null,
              iban: formData.iban || null,
              cartao_da: formData.cartao_da || null,
              cartao_refeicao: formData.cartao_refeicao || null,
              safety_checkup_date: formData.safety_checkup_date
                ? format(formData.safety_checkup_date, 'yyyy-MM-dd')
                : null,
              safety_checkup_renewal_months: formData.safety_checkup_renewal_months
                ? parseInt(formData.safety_checkup_renewal_months)
                : null,
            })
            .eq('id', employee.id);

          if (error) throw error;

          toast({ 
            title: "Colaborador atualizado!", 
            description: "O email foi alterado. O colaborador foi notificado por email." 
          });
          navigate('/admin/colaboradores');
          return;
        }

        // Edit mode - update existing employee (no email change)
        const { error } = await supabase
          .from('employees')
          .update({
            name: formData.name,
            phone: formData.phone || null,
            position: formData.position || null,
            department: formData.department || null,
            company_id: formData.company_id,
            nationality: formData.nationality || null,
            document_number: formData.document_number || null,
            iban: formData.iban || null,
            cartao_da: formData.cartao_da || null,
            cartao_refeicao: formData.cartao_refeicao || null,
            safety_checkup_date: formData.safety_checkup_date
              ? format(formData.safety_checkup_date, 'yyyy-MM-dd')
              : null,
            safety_checkup_renewal_months: formData.safety_checkup_renewal_months
              ? parseInt(formData.safety_checkup_renewal_months)
              : null,
          })
          .eq('id', employee.id);

        if (error) throw error;
        onSaved();
      } else {
        // Create mode - validate password
        if (formData.password.length < 8) {
          toast({
            title: "Erro",
            description: "A senha deve ter pelo menos 8 caracteres.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        if (formData.password !== formData.confirmPassword) {
          toast({
            title: "Erro",
            description: "As senhas não coincidem.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        // Call edge function to create employee with password
        const { data, error } = await supabase.functions.invoke('create-employee-with-password', {
          body: {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            phone: formData.phone || null,
            position: formData.position || null,
            department: formData.department || null,
            company_id: formData.company_id,
            nationality: formData.nationality || null,
            document_number: formData.document_number || null,
            vacation_days: parseFloat(formData.vacation_days) || 22,
            self_schedulable_days: formData.self_schedulable_days ? parseFloat(formData.self_schedulable_days) : null,
            iban: formData.iban || null,
            cartao_da: formData.cartao_da || null,
            cartao_refeicao: formData.cartao_refeicao || null,
          }
        });

        if (error) throw error;

        if (data?.error) {
          toast({
            title: "Erro",
            description: data.error,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        toast({
          title: "Colaborador criado com sucesso!",
          description: "Email com credenciais enviado automaticamente."
        });

        // Navigate to the edit page for the new employee
        if (data?.employeeId) {
          onCreated(data.employeeId);
        } else {
          navigate('/admin/colaboradores');
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description:
          (error && typeof error?.message === "string" && error.message) ||
          (typeof error === "string" ? error : "Ocorreu um erro inesperado."),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Empresa *</label>
              <Select
                value={formData.company_id}
                onValueChange={(value) => setFormData({ ...formData, company_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Nome Completo *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Email *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            {/* Password and vacation fields - only show when creating new employee */}
            {!isEditMode && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Senha Inicial *</label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Confirmar Senha *</label>
                  <Input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Repita a senha"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Dias de férias ({currentYear})</label>
                  <Input
                    type="number"
                    min={0}
                    max={365}
                    step={0.5}
                    value={formData.vacation_days}
                    onChange={(e) => setFormData({ ...formData, vacation_days: e.target.value })}
                    placeholder="22"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Dias que pode marcar</label>
                  <Input
                    type="number"
                    min={0}
                    max={parseFloat(formData.vacation_days) || 365}
                    step={0.5}
                    value={formData.self_schedulable_days}
                    onChange={(e) => setFormData({ ...formData, self_schedulable_days: e.target.value })}
                    placeholder="Todos"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Deixe vazio para todos os dias
                  </p>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nacionalidade</label>
              <Input
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cargo</label>
              <Input
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Departamento</label>
              <Input
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nº Documento</label>
              <Input
                value={formData.document_number}
                onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
              />
            </div>

            {/* Secção Dados Financeiros */}
            <div className="md:col-span-2 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Dados Financeiros
              </h3>
            </div>

            {/* IBAN */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">IBAN</label>
              <Input
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                placeholder="PT50 0000 0000 0000 0000 0000 0"
              />
            </div>

            {/* Nº Cartão Dá */}
            <div>
              <label className="block text-sm font-medium mb-1">Nº Cartão Dá</label>
              <Input
                value={formData.cartao_da}
                onChange={(e) => setFormData({ ...formData, cartao_da: e.target.value })}
              />
            </div>

            {/* Cartão Refeição */}
            <div>
              <label className="block text-sm font-medium mb-1">Cartão Refeição</label>
              <Input
                value={formData.cartao_refeicao}
                onChange={(e) => setFormData({ ...formData, cartao_refeicao: e.target.value })}
              />
            </div>

            {/* Secção Higiene e Segurança no Trabalho */}
            <div className="md:col-span-2 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Higiene e Segurança no Trabalho
              </h3>
            </div>

            {/* Próxima Consulta */}
            <div>
              <label className="block text-sm font-medium mb-1">Próxima Consulta</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.safety_checkup_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.safety_checkup_date ? (
                      format(formData.safety_checkup_date, "dd/MM/yyyy", { locale: pt })
                    ) : (
                      <span>Selecionar data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.safety_checkup_date || undefined}
                    onSelect={(date) => setFormData({ ...formData, safety_checkup_date: date || null })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Renovação (meses) */}
            <div>
              <label className="block text-sm font-medium mb-1">Renovação (meses)</label>
              <Input
                type="number"
                min={1}
                max={60}
                value={formData.safety_checkup_renewal_months}
                onChange={(e) => setFormData({ ...formData, safety_checkup_renewal_months: e.target.value })}
                placeholder="12"
              />
            </div>

            {/* Próxima Renovação Info */}
            {nextRenewalDate && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">
                  Próxima Renovação: <span className="font-medium text-foreground">{format(nextRenewalDate, "dd/MM/yyyy", { locale: pt })}</span>
                  <span className="ml-1">(lembrete 7 dias antes)</span>
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/colaboradores')}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A processar...
                </>
              ) : (
                isEditMode ? "Guardar Alterações" : "Criar Colaborador"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default EmployeeGeneralTab;
