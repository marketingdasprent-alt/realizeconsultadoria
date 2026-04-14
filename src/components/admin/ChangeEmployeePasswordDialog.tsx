import { useState } from "react";
import { Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ChangeEmployeePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
}

const generatePassword = (): string => {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = lower + upper + digits + symbols;

  let password = "";
  // Guarantee at least one of each
  password += lower[Math.floor(Math.random() * lower.length)];
  password += upper[Math.floor(Math.random() * upper.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 4; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

const ChangeEmployeePasswordDialog = ({
  open,
  onOpenChange,
  employeeId,
  employeeName,
}: ChangeEmployeePasswordDialogProps) => {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = () => {
    const pwd = generatePassword();
    setNewPassword(pwd);
    setConfirmPassword(pwd);
    setShowPassword(true);
  };

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos ou clique em 'Gerar'",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As palavras-passe não coincidem",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Erro",
        description: "A palavra-passe deve ter pelo menos 8 caracteres",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await supabase.functions.invoke("change-employee-password", {
        body: {
          employee_id: employeeId,
          new_password: newPassword,
          send_email: sendEmail,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao alterar palavra-passe");
      }

      const data = response.data;
      if (data?.error) {
        throw new Error(data.error);
      }

      if (sendEmail) {
        if (data?.email_success) {
          toast({
            title: "Palavra-passe alterada",
            description: "O colaborador recebeu o email com as novas credenciais.",
          });
        } else {
          toast({
            title: "Palavra-passe alterada (SEM EMAIL)",
            description: `A senha foi alterada, mas o email falhou: ${data?.email_error || "Erro desconhecido"}`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Palavra-passe alterada",
          description: "A palavra-passe foi alterada com sucesso.",
        });
      }

      setNewPassword("");
      setConfirmPassword("");
      setSendEmail(true);
      setShowPassword(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível alterar a palavra-passe",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
      setSendEmail(true);
      setShowPassword(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Definir Nova Senha</DialogTitle>
          <DialogDescription>
            Definir nova palavra-passe para <strong>{employeeName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Não é possível recuperar a palavra-passe atual. Ao guardar, será definida uma nova palavra-passe.
          </p>

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={handleGenerate}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Gerar palavra-passe
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Nova Palavra-passe</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Palavra-passe</Label>
            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repetir palavra-passe"
              autoComplete="new-password"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="send-email"
              checked={sendEmail}
              onCheckedChange={(checked) => setSendEmail(checked === true)}
            />
            <Label htmlFor="send-email" className="text-sm font-normal cursor-pointer">
              Enviar email com as novas credenciais
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="gold" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                A guardar...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChangeEmployeePasswordDialog;
