import { useState, useEffect } from "react";
import { Loader2, Users, Plus, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  user_id: string;
  name: string;
  email: string;
}

interface AdminGroup {
  id: string;
  name: string;
  is_super_admin: boolean;
  is_active: boolean;
}

interface GroupMembership {
  id: string;
  group_id: string;
  user_id: string;
  group_name: string;
  is_super_admin: boolean;
}

interface AdminGroupMembersManagerProps {
  admins: AdminUser[];
  isLoadingAdmins: boolean;
  onRefresh: () => void;
}

const AdminGroupMembersManager = ({ admins, isLoadingAdmins, onRefresh }: AdminGroupMembersManagerProps) => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [groupsRes, membershipsRes] = await Promise.all([
        supabase.from('admin_groups').select('*').eq('is_active', true).order('name'),
        supabase.from('admin_group_members').select(`
          id,
          group_id,
          user_id,
          admin_groups (name, is_super_admin)
        `)
      ]);

      setGroups(groupsRes.data || []);
      
      const mappedMemberships = (membershipsRes.data || []).map((m: any) => ({
        id: m.id,
        group_id: m.group_id,
        user_id: m.user_id,
        group_name: m.admin_groups?.name || 'Grupo desconhecido',
        is_super_admin: m.admin_groups?.is_super_admin || false
      }));
      
      setMemberships(mappedMemberships);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getAdminGroups = (userId: string): GroupMembership[] => {
    return memberships.filter(m => m.user_id === userId);
  };

  const getAvailableGroups = (userId: string): AdminGroup[] => {
    const userGroupIds = memberships
      .filter(m => m.user_id === userId)
      .map(m => m.group_id);
    return groups.filter(g => !userGroupIds.includes(g.id));
  };

  const handleOpenDialog = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setSelectedGroupId("");
    setIsDialogOpen(true);
  };

  const handleAddToGroup = async () => {
    if (!selectedAdmin || !selectedGroupId) return;

    setIsAdding(true);
    try {
      const { error } = await supabase
        .from('admin_group_members')
        .insert({
          group_id: selectedGroupId,
          user_id: selectedAdmin.user_id
        });

      if (error) throw error;

      toast({ title: "Administrador adicionado ao grupo!" });
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveFromGroup = async (membershipId: string) => {
    setIsRemoving(membershipId);
    try {
      const { error } = await supabase
        .from('admin_group_members')
        .delete()
        .eq('id', membershipId);

      if (error) throw error;

      toast({ title: "Administrador removido do grupo" });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRemoving(null);
    }
  };

  if (isLoading || isLoadingAdmins) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-xl">Grupos dos Administradores</CardTitle>
          <CardDescription>
            Associar administradores a grupos de acesso para definir suas permissões
          </CardDescription>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum administrador encontrado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Grupos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => {
                  const adminGroups = getAdminGroups(admin.user_id);
                  const availableGroups = getAvailableGroups(admin.user_id);
                  const isSuperAdmin = adminGroups.some(g => g.is_super_admin);

                  return (
                    <TableRow key={admin.user_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {admin.name}
                          {isSuperAdmin && (
                            <Shield className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {admin.email}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {adminGroups.length === 0 ? (
                            <span className="text-muted-foreground text-sm">Sem grupos</span>
                          ) : (
                            adminGroups.map((membership) => (
                              <Badge 
                                key={membership.id} 
                                variant={membership.is_super_admin ? "default" : "secondary"}
                                className="flex items-center gap-1"
                              >
                                {membership.group_name}
                                <button
                                  onClick={() => handleRemoveFromGroup(membership.id)}
                                  className="ml-1 hover:text-destructive"
                                  disabled={isRemoving === membership.id}
                                >
                                  {isRemoving === membership.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <X className="h-3 w-3" />
                                  )}
                                </button>
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {availableGroups.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(admin)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Adicionar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add to Group Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar a Grupo</DialogTitle>
            <DialogDescription>
              Adicionar <strong>{selectedAdmin?.name}</strong> a um grupo de acesso
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um grupo" />
              </SelectTrigger>
              <SelectContent>
                {selectedAdmin && getAvailableGroups(selectedAdmin.user_id).map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center gap-2">
                      {group.is_super_admin && <Shield className="h-4 w-4 text-primary" />}
                      {group.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isAdding}>
              Cancelar
            </Button>
            <Button 
              variant="gold" 
              onClick={handleAddToGroup} 
              disabled={isAdding || !selectedGroupId}
            >
              {isAdding ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              {isAdding ? "A adicionar..." : "Adicionar ao Grupo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminGroupMembersManager;
