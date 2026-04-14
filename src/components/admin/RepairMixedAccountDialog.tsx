import { useState } from "react";
import { AlertTriangle, Loader2, Wrench } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RepairMixedAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admin: {
    user_id: string;
    name: string;
    email: string; // This is the profile email (corporate)
    auth_email?: string; // This is the current auth email (may be personal)
  } | null;
  onSuccess: () => void;
}

const RepairMixedAccountDialog = ({
  open,
  onOpenChange,
  admin,
  onSuccess,
}: RepairMixedAccountDialogProps) => {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRepairing, setIsRepairing] = useState(false);

  const handleRepair = async () => {
    if (!admin) return;

    if (password.length < 8) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 8 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    setIsRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke("repair-mixed-account", {
        body: {
          admin_user_id: admin.user_id,
          employee_password: password,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Conta reparada!",
        description: data.message || "A conta foi separada com sucesso.",
      });

      setPassword("");
      setConfirmPassword("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível reparar a conta",
        variant: "destructive",
      });
    } finally {
      setIsRepairing(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setConfirmPassword("");
    onOpenChange(false);
  };

  if (!admin) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-500" />
            Reparar Conta Misturada
          </DialogTitle>
          <DialogDescription>
            Esta conta tem um conflito entre o email de administrador e o email de login.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm space-y-2">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Conflito detetado:
                </p>
                <div className="text-amber-700 dark:text-amber-300 space-y-1">
                  <p>
                    <strong>Login atual:</strong>{" "}
                    <span className="font-mono text-xs">{admin.auth_email}</span>
                  </p>
                  <p>
                    <strong>Email admin:</strong>{" "}
                    <span className="font-mono text-xs">{admin.email}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
            <p className="font-medium">A reparação irá:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Restaurar o login de admin para <strong>{admin.email}</strong></li>
              <li>Criar conta de colaborador com <strong>{admin.auth_email}</strong></li>
              <li>Enviar email com credenciais ao colaborador</li>
            </ol>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">
              Defina a senha para a nova conta de colaborador:
            </p>
            <div className="space-y-2">
              <Label htmlFor="repair-password">Senha do colaborador</Label>
              <Input
                id="repair-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repair-confirm-password">Confirmar senha</Label>
              <Input
                id="repair-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
              />
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-sm text-destructive">As senhas não coincidem</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isRepairing}>
            Cancelar
          </Button>
          <Button
            variant="gold"
            onClick={handleRepair}
            disabled={isRepairing || !password || password.length < 8 || password !== confirmPassword}
          >
            {isRepairing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                A reparar...
              </>
            ) : (
              <>
                <Wrench className="h-4 w-4 mr-2" />
                Reparar Conta
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RepairMixedAccountDialog;
