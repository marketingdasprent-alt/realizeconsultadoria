import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Loader2, Mail, Send, UploadCloud, X, CheckCircle2, History, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

interface Employee {
  id: string;
  name: string;
  email: string;
  company: {
    name: string;
  };
}

interface MarketingEmail {
  id: string;
  subject: string;
  message: string;
  sender: string;
  cc_emails: string[] | null;
  recipients_count: number;
  created_at: string;
}

const MarketingEmailTab = () => {
  const { toast } = useToast();
  
  // Tab states
  const [activeTab, setActiveTab] = useState("new");
  
  // Data states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [emailHistory, setEmailHistory] = useState<MarketingEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form states
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  
  // Action states
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('id, name, email, company:companies(name)')
        .eq('is_active', true)
        .order('name');
        
      if (employeesError) throw employeesError;
      
      // We safely cast the company relationship based on how we queried it
      const formattedEmployees = (employeesData || []).map(emp => ({
        ...emp,
        company: Array.isArray(emp.company) ? emp.company[0] : emp.company
      })) as Employee[];
      
      setEmployees(formattedEmployees);

      // Fetch history
      const { data: historyData, error: historyError } = await supabase
        .from('marketing_emails')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (historyError && historyError.code !== '42P01') {
        throw historyError;
      }
      
      if (historyData) {
        setEmailHistory(historyData);
      }
    } catch (error: any) {
      console.error("Error fetching marketing data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const selectAllEmployees = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(emp => emp.id));
    }
  };

  const handleSendEmail = async () => {
    if (!subject.trim()) return toast({ title: "Erro", description: "O assunto é obrigatório", variant: "destructive" });
    if (!message.trim()) return toast({ title: "Erro", description: "A mensagem é obrigatória", variant: "destructive" });
    if (!senderName.trim()) return toast({ title: "Erro", description: "O nome do remetente é obrigatório", variant: "destructive" });
    if (selectedEmployees.length === 0) return toast({ title: "Erro", description: "Selecione pelo menos um destinatário", variant: "destructive" });

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      // Obter os emails dos colaboradores selecionados
      const recipientEmails = employees
        .filter(emp => selectedEmployees.includes(emp.id))
        .map(emp => emp.email)
        .filter(email => email);

      // Upload files
      const uploadedAttachments = [];
      if (files.length > 0) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${crypto.randomUUID()}.${fileExt}`;
          const filePath = `${session.user.id}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('marketing-emails')
            .upload(filePath, file);
            
          if (uploadError) throw uploadError;
          
          uploadedAttachments.push({
            name: file.name,
            path: filePath,
            type: file.type,
            size: file.size
          });
        }
      }

      // Invoke Edge Function to send email
      const { data: funcData, error: funcError } = await supabase.functions.invoke('send-marketing-email', {
        body: {
          subject,
          message,
          senderName,
          recipients: recipientEmails,
          attachments: uploadedAttachments
        }
      });

      if (funcError) throw funcError;
      if (funcData?.error) throw new Error(funcData.error);

      // Save to history
      const { error: dbError } = await supabase.from('marketing_emails').insert({
        subject,
        message,
        sender: senderName,
        cc_emails: null,
        recipients_count: recipientEmails.length,
        attachments_metadata: uploadedAttachments.length > 0 ? uploadedAttachments : null,
        created_by: session.user.id
      });

      if (dbError) {
        console.error("Erro a guardar histórico:", dbError);
        // We don't throw here to not show an error to the user if the email actually sent
      }

      toast({
        title: "E-mail enviado com sucesso!",
        description: `Enviado para ${recipientEmails.length} colaborador(es).`,
      });

      // Reset form
      setSubject("");
      setMessage("");
      setSenderName("");
      setSelectedEmployees([]);
      setFiles([]);
      
      // Refresh history
      fetchData();
      setActiveTab("history");

    } catch (error: any) {
      console.error("Erro a enviar e-mail:", error);
      toast({
        title: "Erro ao enviar e-mail",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            Comunicação Interna (Marketing)
          </h2>
          <p className="text-muted-foreground mt-1">
            Envio de comunicações e documentos para os colaboradores.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-background border shadow-sm">
          <TabsTrigger value="new" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Send className="h-4 w-4" />
            Novo E-mail
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <History className="h-4 w-4" />
            Histórico de Envios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 shadow-card">
              <CardHeader>
                <CardTitle>Composição do E-mail</CardTitle>
                <CardDescription>O e-mail será enviado através de marketing@dasprent.pt</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sender">Nome do Remetente *</Label>
                  <Input 
                    id="sender" 
                    placeholder="Ex: Departamento de Marketing" 
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Assunto *</Label>
                  <Input 
                    id="subject" 
                    placeholder="Assunto da comunicação" 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem *</Label>
                  <Textarea 
                    id="message" 
                    placeholder="Escreva a sua mensagem aqui..." 
                    className="min-h-[200px]"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <Label>Anexos</Label>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer ${
                      isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <UploadCloud className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium text-center">
                      Arraste ficheiros para aqui ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground text-center">
                      Qualquer formato de documento é suportado
                    </p>
                    <input 
                      id="file-upload" 
                      type="file" 
                      multiple 
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                  </div>

                  {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded bg-secondary/50">
                          <span className="text-sm truncate max-w-[80%]">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeFile(index)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button 
                    className="w-full sm:w-auto min-w-[150px]" 
                    onClick={handleSendEmail}
                    disabled={isSending || selectedEmployees.length === 0 || !subject.trim() || !message.trim() || !senderName.trim()}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        A Enviar...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar E-mail
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Destinatários *
                    </CardTitle>
                    <CardDescription>
                      {selectedEmployees.length} de {employees.length} selecionados
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={selectAllEmployees}>
                    {selectedEmployees.length === employees.length ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    {employees.map((emp) => (
                      <div 
                        key={emp.id} 
                        className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedEmployees.includes(emp.id) ? 'bg-primary/5 border-primary/20' : 'hover:bg-secondary'
                        }`}
                        onClick={() => toggleEmployeeSelection(emp.id)}
                      >
                        <Checkbox 
                          checked={selectedEmployees.includes(emp.id)}
                          onCheckedChange={() => toggleEmployeeSelection(emp.id)}
                          id={`emp-${emp.id}`}
                          className="mt-1"
                        />
                        <div className="grid gap-1.5 leading-none flex-1">
                          <label
                            htmlFor={`emp-${emp.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {emp.name}
                          </label>
                          <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                          <p className="text-[10px] text-muted-foreground bg-secondary w-fit px-2 py-0.5 rounded uppercase">
                            {emp.company?.name || 'Sem empresa'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Histórico de Envios</CardTitle>
              <CardDescription>Registo de todos os e-mails enviados pelo módulo de marketing</CardDescription>
            </CardHeader>
            <CardContent>
              {emailHistory.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed bg-secondary/30">
                  <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">Ainda não existem e-mails no histórico.</p>
                </div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Assunto</TableHead>
                        <TableHead>Remetente</TableHead>
                        <TableHead className="text-right">Destinatários</TableHead>
                        <TableHead className="text-center">Anexos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailHistory.map((email) => (
                        <TableRow key={email.id}>
                          <TableCell className="font-medium">
                            {format(new Date(email.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{email.subject}</span>
                              {email.cc_emails && email.cc_emails.length > 0 && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  CC: {email.cc_emails.join(', ')}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{email.sender}</TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center justify-center bg-primary/10 text-primary font-medium px-2.5 py-0.5 rounded-full text-xs">
                              {email.recipients_count} 
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {email.attachments_metadata && Array.isArray(email.attachments_metadata) ? (
                              <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                                {email.attachments_metadata.length} ficheiro(s)
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarketingEmailTab;
