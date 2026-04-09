import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ResendInviteSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  newPassword: string;
}

const ResendInviteSuccessDialog = ({
  open,
  onOpenChange,
  employeeName,
  newPassword,
}: ResendInviteSuccessDialogProps) => {
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(newPassword);
    toast({
      title: "Copiado!",
      description: "Senha copiada para a área de transferência.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-width-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Convite Re-enviado!
          </DialogTitle>
          <DialogDescription>
            Um novo email de boas-vindas foi enviado para <strong>{employeeName}</strong>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-muted p-4 rounded-lg my-4 space-y-2 border-l-4 border-gold">
          <p className="text-sm font-medium text-muted-foreground">Nova Senha Gerada:</p>
          <div className="flex items-center justify-between gap-2">
            <code className="text-lg font-mono font-bold tracking-wider">{newPassword}</code>
            <Button size="icon" variant="ghost" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Por segurança, esta senha só será exibida agora. <br />
          Pode copiá-la para enviar manualmente se necessário.
        </p>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="gold" className="w-full">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResendInviteSuccessDialog;
