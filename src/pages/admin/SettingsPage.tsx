import { useState, useEffect } from "react";
import { Save, User, Shield, Bell, AlertTriangle, Trash2, Plus, Users, UserPlus, Loader2, Pencil, X, Key, Headset, FolderKey, Building2, Wrench } from "lucide-react";
import SupportSubjectsManager from "@/components/admin/SupportSubjectsManager";
import SupportDepartmentsManager from "@/components/admin/SupportDepartmentsManager";
import ChangeAdminPasswordDialog from "@/components/admin/ChangeAdminPasswordDialog";
import RepairMixedAccountDialog from "@/components/admin/RepairMixedAccountDialog";
import AdminGroupsManager from "@/components/admin/AdminGroupsManager";
import AdminGroupMembersManager from "@/components/admin/AdminGroupMembersManager";
import { NotificationEmailsManager } from "@/components/admin/NotificationEmailsManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface Company {
  id: string;
  name: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  company_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface AdminUser {
  user_id: string;
  name: string;
  email: string;
  auth_email?: string; // The actual email in auth.users (may differ from profile)
  has_email_conflict?: boolean;
  created_at: string;
}

const SettingsPage = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
  });

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Messages state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [messageTitle, setMessageTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);

  // Admin access state
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [changePasswordAdmin, setChangePasswordAdmin] = useState<AdminUser | null>(null);
  const [repairAdmin, setRepairAdmin] = useState<AdminUser | null>(null);


  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (data) {
          setProfile({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
          });
        }
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchCompaniesAndNotifications = async () => {
      const [companiesRes, notificationsRes] = await Promise.all([
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }),
      ]);
      
      setCompanies(companiesRes.data || []);
      setNotifications(notificationsRes.data || []);
    };
    fetchCompaniesAndNotifications();
  }, []);

  const fetchAdmins = async () => {
    setIsLoadingAdmins(true);
    try {
      // Get all admin user_ids from user_roles
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, created_at')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      if (!adminRoles || adminRoles.length === 0) {
        setAdmins([]);
        return;
      }

      // Get profiles for these users
      const userIds = adminRoles.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Get auth emails to detect conflicts
      let authEmails: Record<string, string> = {};
      try {
        const { data: authData, error: authError } = await supabase.functions.invoke('get-admin-auth-emails', {
          body: { user_ids: userIds },
        });
        if (!authError && authData?.auth_emails) {
          authEmails = authData.auth_emails;
        }
      } catch (e) {
        console.error('Error fetching auth emails:', e);
      }

      // Combine data
      const adminUsers: AdminUser[] = adminRoles.map(role => {
        const profile = profiles?.find(p => p.user_id === role.user_id);
        const profileEmail = profile?.email?.toLowerCase() || '';
        const authEmail = authEmails[role.user_id]?.toLowerCase() || '';
        const hasConflict = authEmail && profileEmail && authEmail !== profileEmail;
        
        return {
          user_id: role.user_id,
          name: profile?.name || 'Sem nome',
          email: profile?.email || 'Email não disponível',
          auth_email: authEmail || undefined,
          has_email_conflict: hasConflict,
          created_at: role.created_at,
        };
      });

      setAdmins(adminUsers);
    } catch (error: any) {
      console.error('Error fetching admins:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os administradores",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAdmins(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleProfileSave = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada");

      const { error } = await supabase
        .from('profiles')
        .update({
          name: profile.name,
          phone: profile.phone,
        })
        .eq('user_id', session.user.id);

      if (error) throw error;
      toast({ title: "Perfil atualizado com sucesso!" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
    setIsLoading(false);
  }
};

const handleChangePassword = async () => {
  if (newPassword.length < 8) {
    toast({
      title: "Erro",
      description: "A palavra-passe deve ter pelo menos 8 caracteres.",
      variant: "destructive",
    });
    return;
  }

  if (newPassword !== confirmPassword) {
    toast({
      title: "Erro",
      description: "As palavras-passe não coincidem.",
      variant: "destructive",
    });
    return;
  }

  setIsChangingPassword(true);
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) throw error;

    toast({ title: "Palavra-passe alterada com sucesso!" });
    setNewPassword("");
    setConfirmPassword("");
  } catch (error: any) {
    toast({
      title: "Erro",
      description: error.message,
      variant: "destructive",
    });
  } finally {
    setIsChangingPassword(false);
  }
};

  const handleSendMessage = async () => {
    if (!messageTitle.trim() || !messageContent.trim()) {
      toast({
        title: "Erro",
        description: "Por favor preencha o título e a mensagem.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingMessage(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada");

      const { data, error } = await supabase
        .from('notifications')
        .insert({
          title: messageTitle.trim(),
          message: messageContent.trim(),
          company_id: selectedCompany === "all" ? null : selectedCompany,
          created_by: session.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setNotifications([data, ...notifications]);
      setMessageTitle("");
      setMessageContent("");
      setSelectedCompany("all");

      toast({ title: "Aviso criado com sucesso!" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleToggleNotification = async (notificationId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_active: !currentState })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, is_active: !currentState } : n
      ));

      toast({ title: currentState ? "Aviso desativado" : "Aviso ativado" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(notifications.filter(n => n.id !== notificationId));
      toast({ title: "Aviso eliminado" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStartEditNotification = (notification: Notification) => {
    setEditingNotification(notification);
    setMessageTitle(notification.title);
    setMessageContent(notification.message);
    setSelectedCompany(notification.company_id || "all");
  };

  const handleCancelEditNotification = () => {
    setEditingNotification(null);
    setMessageTitle("");
    setMessageContent("");
    setSelectedCompany("all");
  };

  const handleUpdateNotification = async () => {
    if (!editingNotification) return;

    if (!messageTitle.trim() || !messageContent.trim()) {
      toast({
        title: "Erro",
        description: "Por favor preencha o título e a mensagem.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingMessage(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          title: messageTitle.trim(),
          message: messageContent.trim(),
          company_id: selectedCompany === "all" ? null : selectedCompany,
        })
        .eq('id', editingNotification.id);

      if (error) throw error;

      setNotifications(notifications.map(n =>
        n.id === editingNotification.id
          ? { ...n, title: messageTitle.trim(), message: messageContent.trim(), company_id: selectedCompany === "all" ? null : selectedCompany }
          : n
      ));
      handleCancelEditNotification();
      toast({ title: "Aviso atualizado com sucesso!" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return "Todas as Empresas";
    return companies.find(c => c.id === companyId)?.name || "Empresa desconhecida";
  };

  const handleInviteAdmin = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Erro",
        description: "Por favor insira o email do novo administrador.",
        variant: "destructive",
      });
      return;
    }

    if (!invitePassword || invitePassword.length < 8) {
      toast({
        title: "Erro",
        description: "A palavra-passe deve ter pelo menos 8 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setIsInviting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada");

      const { data, error } = await supabase.functions.invoke('invite-admin', {
        body: { 
          email: inviteEmail.trim(), 
          name: inviteName.trim() || undefined,
          password: invitePassword
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setInviteEmail("");
      setInviteName("");
      setInvitePassword("");
      await fetchAdmins();

      toast({ 
        title: "Administrador criado!", 
        description: "O novo administrador receberá um email com os dados de acesso." 
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    setRemovingUserId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada");

      const { data, error } = await supabase.functions.invoke('remove-admin', {
        body: { user_id: userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await fetchAdmins();
      toast({ title: "Administrador removido com sucesso!" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRemovingUserId(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-semibold">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerir preferências da conta e do sistema
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-2">
              <Users className="h-4 w-4" />
              Acessos
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <FolderKey className="h-4 w-4" />
              Grupos
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="avisos" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Avisos
            </TabsTrigger>
            <TabsTrigger value="suporte" className="gap-2">
              <Headset className="h-4 w-4" />
              Suporte
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-xl">Informações do Perfil</CardTitle>
                <CardDescription>
                  Atualize as suas informações pessoais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={profile.email}
                      disabled
                      className="mt-1 bg-muted"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button variant="gold" onClick={handleProfileSave} disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? "A guardar..." : "Guardar Alterações"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-xl">Segurança</CardTitle>
                <CardDescription>
                  Gerir palavra-passe e autenticação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Alterar Palavra-passe</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="new-password">Nova Palavra-passe</Label>
                      <Input 
                        id="new-password" 
                        type="password" 
                        className="mt-1"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirm-password">Confirmar Palavra-passe</Label>
                      <Input 
                        id="confirm-password" 
                        type="password" 
                        className="mt-1"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a nova palavra-passe"
                      />
                    </div>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-sm text-destructive mt-2">As palavras-passe não coincidem</p>
                  )}
                </div>
                <div className="flex justify-end pt-4">
                  <Button 
                    variant="gold" 
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !newPassword || !confirmPassword}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isChangingPassword ? "A alterar..." : "Alterar Palavra-passe"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="access">
            <div className="space-y-6">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="font-display text-xl">Criar Novo Administrador</CardTitle>
                  <CardDescription>
                    O novo administrador receberá um email com os dados de acesso
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="invite-name">Nome *</Label>
                      <Input
                        id="invite-name"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Nome do administrador"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="invite-email">Email *</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="email@exemplo.pt"
                        className="mt-1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="invite-password">Palavra-passe *</Label>
                      <Input
                        id="invite-password"
                        type="password"
                        value={invitePassword}
                        onChange={(e) => setInvitePassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Esta será a palavra-passe inicial do administrador
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button 
                      variant="gold" 
                      onClick={handleInviteAdmin} 
                      disabled={isInviting || !inviteEmail.trim() || !invitePassword || invitePassword.length < 8}
                    >
                      {isInviting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
                      )}
                      {isInviting ? "A criar..." : "Criar Administrador"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="font-display text-xl">Administradores Atuais</CardTitle>
                  <CardDescription>
                    Gerir acessos de administração do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingAdmins ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : admins.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhum administrador encontrado.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Data de Criação</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {admins.map((admin) => (
                          <TableRow key={admin.user_id}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  {admin.name}
                                  {admin.user_id === currentUserId && (
                                    <Badge variant="secondary">Você</Badge>
                                  )}
                                </div>
                                {admin.has_email_conflict && (
                                  <div className="flex items-center gap-1 text-xs text-amber-600">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Conflito de email</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <span>{admin.email}</span>
                                {admin.has_email_conflict && admin.auth_email && (
                                  <span className="text-xs text-muted-foreground">
                                    Login: {admin.auth_email}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(admin.created_at), "d 'de' MMMM 'de' yyyy", { locale: pt })}
                            </TableCell>
                            <TableCell className="text-right">
                              {admin.user_id !== currentUserId ? (
                                <div className="flex items-center justify-end gap-1">
                                  {admin.has_email_conflict && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setRepairAdmin(admin)}
                                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                      title="Reparar conta misturada"
                                    >
                                      <Wrench className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setChangePasswordAdmin(admin)}
                                    title="Alterar Palavra-passe"
                                  >
                                    <Key className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        disabled={removingUserId === admin.user_id}
                                      >
                                        {removingUserId === admin.user_id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remover Administrador</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Tem a certeza que deseja remover o acesso de administrador de <strong>{admin.name}</strong>?
                                          Esta ação pode ser revertida convidando o utilizador novamente.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleRemoveAdmin(admin.user_id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Remover
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <ChangeAdminPasswordDialog
                admin={changePasswordAdmin}
                open={!!changePasswordAdmin}
                onOpenChange={(open) => !open && setChangePasswordAdmin(null)}
              />

              <RepairMixedAccountDialog
                admin={repairAdmin}
                open={!!repairAdmin}
                onOpenChange={(open) => !open && setRepairAdmin(null)}
                onSuccess={fetchAdmins}
              />

              <AdminGroupMembersManager 
                admins={admins}
                isLoadingAdmins={isLoadingAdmins}
                onRefresh={fetchAdmins}
              />
            </div>
          </TabsContent>

          <TabsContent value="groups">
            <AdminGroupsManager />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationEmailsManager />
          </TabsContent>

          <TabsContent value="avisos">
            <div className="space-y-6">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="font-display text-xl">
                    {editingNotification ? "Editar Aviso" : "Criar Aviso"}
                  </CardTitle>
                  <CardDescription>
                    {editingNotification 
                      ? "Editar o aviso selecionado" 
                      : "Criar avisos permanentes para os colaboradores"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="company">Empresa</Label>
                    <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Empresas</SelectItem>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      value={messageTitle}
                      onChange={(e) => setMessageTitle(e.target.value)}
                      placeholder="Título do aviso"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="message">Descrição</Label>
                    <Textarea
                      id="message"
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      placeholder="Escreva o conteúdo do aviso..."
                      className="mt-1"
                      rows={4}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    {editingNotification ? (
                      <>
                        <Button variant="outline" onClick={handleCancelEditNotification} disabled={isSendingMessage}>
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                        <Button variant="gold" onClick={handleUpdateNotification} disabled={isSendingMessage}>
                          <Save className="h-4 w-4 mr-2" />
                          {isSendingMessage ? "A guardar..." : "Guardar"}
                        </Button>
                      </>
                    ) : (
                      <Button variant="gold" onClick={handleSendMessage} disabled={isSendingMessage}>
                        <Plus className="h-4 w-4 mr-2" />
                        {isSendingMessage ? "A criar..." : "Criar Aviso"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="font-display text-xl">Avisos Cadastrados</CardTitle>
                  <CardDescription>
                    Gerir avisos ativos e inativos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {notifications.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Ainda não existem avisos cadastrados.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="p-4 border border-border rounded-lg"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium truncate">{notification.title}</h4>
                                <Badge variant={notification.is_active ? "default" : "secondary"}>
                                  {notification.is_active ? "Ativa" : "Inativa"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{getCompanyName(notification.company_id)}</span>
                                <span>•</span>
                                <span>
                                  {format(new Date(notification.created_at), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: pt })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartEditNotification(notification)}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleNotification(notification.id, notification.is_active)}
                              >
                                {notification.is_active ? "Desativar" : "Ativar"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteNotification(notification.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="suporte">
            <div className="space-y-6">
              <SupportDepartmentsManager />
              <SupportSubjectsManager />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default SettingsPage;
