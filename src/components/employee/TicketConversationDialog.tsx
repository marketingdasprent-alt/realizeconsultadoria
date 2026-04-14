import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Send, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TicketReply {
  id: string;
  message: string;
  sender_role: string;
  created_at: string;
  user_id: string;
}

const statusLabels: Record<string, string> = {
  open: "Em Aberto",
  in_progress: "Em Progresso",
  resolved: "Resolvido",
  closed: "Fechado",
};

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "secondary",
  in_progress: "outline",
  resolved: "default",
  closed: "destructive",
};

interface TicketConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: {
    id: string;
    subject: string;
    message: string;
    created_at: string;
    admin_notes: string | null;
    status: string;
    department_id: string | null;
  } | null;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  companyName: string;
  onReplySent: () => void;
}

const TicketConversationDialog = ({
  open,
  onOpenChange,
  ticket,
  employeeId,
  employeeName,
  employeeEmail,
  companyName,
  onReplySent,
}: TicketConversationDialogProps) => {
  const { toast } = useToast();
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadReplies = async () => {
    if (!ticket) return;
    setIsLoading(true);
    const { data } = await supabase
      .from("support_ticket_replies")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    setReplies(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    if (open && ticket) {
      loadReplies();
      setNewMessage("");
    }
  }, [open, ticket?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replies]);

  // Realtime
  useEffect(() => {
    if (!open || !ticket) return;
    const channel = supabase
      .channel(`employee-ticket-replies-${ticket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_ticket_replies",
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          setReplies((prev) => [...prev, payload.new as TicketReply]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, ticket?.id]);

  const handleSendReply = async () => {
    if (!ticket || !newMessage.trim()) return;
    setIsSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("support_ticket_replies")
        .insert({
          ticket_id: ticket.id,
          user_id: user.id,
          sender_role: "employee",
          message: newMessage.trim(),
        });
      if (error) throw error;

      // Notify admins
      try {
        await supabase.functions.invoke("send-ticket-reply-notification", {
          body: {
            ticketId: ticket.id,
            employeeName,
            employeeEmail,
            companyName,
            subject: ticket.subject,
            message: newMessage.trim(),
            departmentId: ticket.department_id,
          },
        });
      } catch (e) {
        console.error("Failed to send reply notification:", e);
      }

      setNewMessage("");
      onReplySent();
      toast({ title: "Resposta enviada!" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!ticket) return null;

  const isClosed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-6">
            <DialogTitle className="font-display text-base lg:text-lg flex-1 min-w-0 truncate">
              {ticket.subject}
            </DialogTitle>
            <Badge variant={statusColors[ticket.status]} className="shrink-0 text-[10px]">
              {statusLabels[ticket.status]}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 max-h-[50vh] pr-3" ref={scrollRef as any}>
          <div className="space-y-3 py-2">
            {/* Original message */}
            <div className="flex gap-2">
              <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">Eu</span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
                </div>
              </div>
            </div>

            {/* Legacy admin_notes */}
            {ticket.admin_notes && replies.length === 0 && (
              <div className="flex gap-2 justify-end">
                <div className="flex-1 min-w-0 max-w-[85%]">
                  <div className="bg-gold/10 border border-gold/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">Equipa de Suporte</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{ticket.admin_notes}</p>
                  </div>
                </div>
                <div className="shrink-0 w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center">
                  <Shield className="h-3.5 w-3.5 text-gold" />
                </div>
              </div>
            )}

            {/* Replies */}
            {isLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gold mx-auto" />
              </div>
            ) : (
              replies.map((reply) => {
                const isAdmin = reply.sender_role === "admin";
                return (
                  <div
                    key={reply.id}
                    className={`flex gap-2 ${isAdmin ? "justify-end" : ""}`}
                  >
                    {!isAdmin && (
                      <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className={`flex-1 min-w-0 ${isAdmin ? "max-w-[85%]" : ""}`}>
                      <div
                        className={`rounded-lg p-3 ${
                          isAdmin
                            ? "bg-gold/10 border border-gold/20"
                            : "bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">
                            {isAdmin ? "Equipa de Suporte" : "Eu"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(reply.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="shrink-0 w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center">
                        <Shield className="h-3.5 w-3.5 text-gold" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Reply input */}
        {!isClosed ? (
          <div className="border-t border-border pt-3 mt-2">
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escrever resposta..."
                rows={2}
                className="resize-none text-sm"
                disabled={isSending}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
              />
              <Button
                variant="gold"
                size="icon"
                className="shrink-0 h-auto"
                onClick={handleSendReply}
                disabled={isSending || !newMessage.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Enter para enviar • Shift+Enter para nova linha
            </p>
          </div>
        ) : (
          <div className="border-t border-border pt-3 mt-2 text-center">
            <p className="text-xs text-muted-foreground">
              Este ticket está {statusLabels[ticket.status].toLowerCase()}. Não é possível responder.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TicketConversationDialog;
