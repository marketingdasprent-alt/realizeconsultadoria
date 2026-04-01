import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2, Users, Shield, X, Save, ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS_CONFIG, MODULE_LABELS, ALL_MODULE_KEYS } from "@/lib/permissions-config";

interface AdminGroup {
  id: string;
  name: string;
  description: string | null;
  is_super_admin: boolean;
  is_active: boolean;
  member_count?: number;
}

interface TopicPermission {
  module_key: string;
  topic_key: string | null;
  can_view: boolean;
  can_execute: boolean;
}

interface SupportDepartment {
  id: string;
  name: string;
  is_active: boolean;
}

const AdminGroupsManager = () => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [supportDepartments, setSupportDepartments] = useState<SupportDepartment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminGroup | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [permissions, setPermissions] = useState<TopicPermission[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());

  // Initialize permissions from config
  const initializePermissions = (): TopicPermission[] => {
    const perms: TopicPermission[] = [];
    PERMISSIONS_CONFIG.forEach(module => {
      module.topics.forEach(topic => {
        perms.push({
          module_key: module.moduleKey,
          topic_key: topic.key,
          can_view: false,
          can_execute: false
        });
      });
    });
    return perms;
  };

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const [groupsRes, departmentsRes] = await Promise.all([
        supabase
          .from('admin_groups')
          .select('*')
          .order('is_super_admin', { ascending: false })
          .order('name'),
        supabase
          .from('support_departments')
          .select('id, name, is_active')
          .order('sort_order', { ascending: true })
      ]);

      if (groupsRes.error) throw groupsRes.error;

      // Get member counts
      const { data: memberCounts } = await supabase
        .from('admin_group_members')
        .select('group_id');

      const countMap = new Map<string, number>();
      memberCounts?.forEach(m => {
        countMap.set(m.group_id, (countMap.get(m.group_id) || 0) + 1);
      });

      const groupsWithCounts = (groupsRes.data || []).map(g => ({
        ...g,
        member_count: countMap.get(g.id) || 0
      }));

      setGroups(groupsWithCounts);
      setSupportDepartments(departmentsRes.data || []);
    } catch (error: any) {
      console.error('Error fetching groups:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os grupos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const resetForm = () => {
    setName("");
    setDescription("");
    setIsSuperAdmin(false);
    setPermissions(initializePermissions());
    setSelectedDepartments(new Set());
    setEditingGroup(null);
    setExpandedModules(new Set());
  };

  const handleOpenDialog = async (group?: AdminGroup) => {
    if (group) {
      setEditingGroup(group);
      setName(group.name);
      setDescription(group.description || "");
      setIsSuperAdmin(group.is_super_admin);

      // Fetch permissions for this group
      const { data: perms } = await supabase
        .from('admin_group_permissions')
        .select('module_key, topic_key, can_view, can_execute')
        .eq('group_id', group.id);

      const initialPerms = initializePermissions();
      perms?.forEach(p => {
        const idx = initialPerms.findIndex(
          ip => ip.module_key === p.module_key && ip.topic_key === p.topic_key
        );
        if (idx !== -1) {
          initialPerms[idx].can_view = p.can_view;
          initialPerms[idx].can_execute = p.can_execute;
        }
      });
      setPermissions(initialPerms);
      
      // Expand modules that have permissions
      const modulesWithPerms = new Set<string>();
      perms?.forEach(p => {
        if (p.can_view || p.can_execute) {
          modulesWithPerms.add(p.module_key);
        }
      });
      setExpandedModules(modulesWithPerms);

      // Fetch support departments for this group
      const { data: groupDepts } = await supabase
        .from('admin_group_support_departments')
        .select('department_id')
        .eq('group_id', group.id);

      setSelectedDepartments(new Set(groupDepts?.map(d => d.department_id) || []));
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const toggleModule = (moduleKey: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleKey)) {
        next.delete(moduleKey);
      } else {
        next.add(moduleKey);
      }
      return next;
    });
  };

  const handlePermissionChange = (
    moduleKey: string, 
    topicKey: string, 
    field: 'can_view' | 'can_execute', 
    value: boolean
  ) => {
    setPermissions(prev => prev.map(p => {
      if (p.module_key !== moduleKey || p.topic_key !== topicKey) return p;
      return { ...p, [field]: value };
    }));
  };

  const handleModuleToggleAll = (moduleKey: string, field: 'can_view' | 'can_execute', value: boolean) => {
    setPermissions(prev => prev.map(p => {
      if (p.module_key !== moduleKey) return p;
      const topic = PERMISSIONS_CONFIG
        .find(m => m.moduleKey === moduleKey)
        ?.topics.find(t => t.key === p.topic_key);
      
      if (!topic) return p;
      
      // Only toggle if the topic supports this field
      if (field === 'can_view' && !topic.hasView) return p;
      if (field === 'can_execute' && !topic.hasExecute) return p;
      
      return { ...p, [field]: value };
    }));
  };

  const getModulePermissionState = (moduleKey: string, field: 'can_view' | 'can_execute'): boolean | 'indeterminate' => {
    const modulePerms = permissions.filter(p => p.module_key === moduleKey);
    const moduleConfig = PERMISSIONS_CONFIG.find(m => m.moduleKey === moduleKey);
    
    if (!moduleConfig) return false;
    
    const relevantTopics = moduleConfig.topics.filter(t => 
      field === 'can_view' ? t.hasView : t.hasExecute
    );
    
    if (relevantTopics.length === 0) return false;
    
    const checkedCount = modulePerms.filter(p => {
      const topic = relevantTopics.find(t => t.key === p.topic_key);
      return topic && p[field];
    }).length;
    
    if (checkedCount === 0) return false;
    if (checkedCount === relevantTopics.length) return true;
    return 'indeterminate';
  };

  const handleDepartmentToggle = (departmentId: string, checked: boolean) => {
    setSelectedDepartments(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(departmentId);
      } else {
        next.delete(departmentId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "O nome do grupo é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (editingGroup) {
        // Update group
        const { error: updateError } = await supabase
          .from('admin_groups')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            is_super_admin: isSuperAdmin
          })
          .eq('id', editingGroup.id);

        if (updateError) throw updateError;

        // Delete old permissions and insert new ones (only if not super admin)
        if (!isSuperAdmin) {
          await supabase
            .from('admin_group_permissions')
            .delete()
            .eq('group_id', editingGroup.id);

          const permissionsToInsert = permissions
            .filter(p => p.can_view || p.can_execute)
            .map(p => ({
              group_id: editingGroup.id,
              module_key: p.module_key,
              topic_key: p.topic_key,
              can_view: p.can_view,
              can_edit: p.can_execute, // Backwards compatibility: can_edit = can_execute for module-level
              can_execute: p.can_execute
            }));

          if (permissionsToInsert.length > 0) {
            const { error: permError } = await supabase
              .from('admin_group_permissions')
              .insert(permissionsToInsert);

            if (permError) throw permError;
          }

          // Update support departments
          await supabase
            .from('admin_group_support_departments')
            .delete()
            .eq('group_id', editingGroup.id);

          if (selectedDepartments.size > 0) {
            const deptInserts = Array.from(selectedDepartments).map(deptId => ({
              group_id: editingGroup.id,
              department_id: deptId
            }));

            const { error: deptError } = await supabase
              .from('admin_group_support_departments')
              .insert(deptInserts);

            if (deptError) throw deptError;
          }
        } else {
          // Super admin groups don't need explicit permissions
          await supabase
            .from('admin_group_permissions')
            .delete()
            .eq('group_id', editingGroup.id);

          await supabase
            .from('admin_group_support_departments')
            .delete()
            .eq('group_id', editingGroup.id);
        }

        toast({ title: "Grupo atualizado com sucesso!" });
      } else {
        // Create new group
        const { data: newGroup, error: createError } = await supabase
          .from('admin_groups')
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            is_super_admin: isSuperAdmin
          })
          .select()
          .single();

        if (createError) throw createError;

        // Insert permissions (only if not super admin)
        if (!isSuperAdmin && newGroup) {
          const permissionsToInsert = permissions
            .filter(p => p.can_view || p.can_execute)
            .map(p => ({
              group_id: newGroup.id,
              module_key: p.module_key,
              topic_key: p.topic_key,
              can_view: p.can_view,
              can_edit: p.can_execute,
              can_execute: p.can_execute
            }));

          if (permissionsToInsert.length > 0) {
            const { error: permError } = await supabase
              .from('admin_group_permissions')
              .insert(permissionsToInsert);

            if (permError) throw permError;
          }

          // Insert support departments
          if (selectedDepartments.size > 0) {
            const deptInserts = Array.from(selectedDepartments).map(deptId => ({
              group_id: newGroup.id,
              department_id: deptId
            }));

            const { error: deptError } = await supabase
              .from('admin_group_support_departments')
              .insert(deptInserts);

            if (deptError) throw deptError;
          }
        }

        toast({ title: "Grupo criado com sucesso!" });
      }

      handleCloseDialog();
      fetchGroups();
    } catch (error: any) {
      console.error('Error saving group:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (group: AdminGroup) => {
    try {
      const { error } = await supabase
        .from('admin_groups')
        .update({ is_active: !group.is_active })
        .eq('id', group.id);

      if (error) throw error;

      setGroups(prev => prev.map(g => 
        g.id === group.id ? { ...g, is_active: !g.is_active } : g
      ));

      toast({ title: group.is_active ? "Grupo desativado" : "Grupo ativado" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (groupId: string) => {
    setDeletingGroupId(groupId);
    try {
      const { error } = await supabase
        .from('admin_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      setGroups(prev => prev.filter(g => g.id !== groupId));
      toast({ title: "Grupo eliminado" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingGroupId(null);
    }
  };

  const getPermissionsSummary = (group: AdminGroup) => {
    if (group.is_super_admin) return "Acesso total";
    return "Personalizado";
  };

  const activeDepartments = supportDepartments.filter(d => d.is_active);

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-xl">Grupos de Acesso</CardTitle>
              <CardDescription>
                Criar e gerir grupos com permissões específicas por funcionalidade
              </CardDescription>
            </div>
            <Button variant="gold" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Grupo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum grupo de acesso encontrado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Membros</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {group.is_super_admin && <Shield className="h-4 w-4 text-primary" />}
                        {group.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {group.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <Users className="h-3 w-3 mr-1" />
                        {group.member_count}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {group.is_super_admin ? (
                        <Badge variant="default">Super Admin</Badge>
                      ) : (
                        <Badge variant="outline">{getPermissionsSummary(group)}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={group.is_active}
                        onCheckedChange={() => handleToggleActive(group)}
                        disabled={group.is_super_admin}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {group.is_super_admin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            title="O grupo Super Admin não pode ser editado"
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(group)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {!group.is_super_admin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={deletingGroupId === group.id}
                              >
                                {deletingGroupId === group.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar Grupo</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem a certeza que deseja eliminar o grupo <strong>{group.name}</strong>?
                                  Os membros deste grupo perderão as permissões associadas.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(group.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Group Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Editar Grupo" : "Novo Grupo de Acesso"}</DialogTitle>
            <DialogDescription>
              {editingGroup 
                ? "Altere as configurações e permissões do grupo" 
                : "Defina o nome e as permissões para o novo grupo"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="group-name">Nome do Grupo *</Label>
                <Input
                  id="group-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Gestão de Pedidos"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="group-description">Descrição</Label>
                <Input
                  id="group-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição opcional do grupo"
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-super-admin"
                  checked={isSuperAdmin}
                  onCheckedChange={(checked) => setIsSuperAdmin(checked === true)}
                />
                <Label htmlFor="is-super-admin" className="cursor-pointer">
                  Super Admin (acesso total a todos os módulos e funcionalidades)
                </Label>
              </div>
            </div>

            {!isSuperAdmin && (
              <>
                <div>
                  <Label className="text-base font-medium">Permissões por Funcionalidade</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Selecione quais funcionalidades este grupo pode visualizar e executar em cada módulo
                  </p>
                  <div className="border rounded-lg divide-y">
                    {PERMISSIONS_CONFIG.map((module) => {
                      const isExpanded = expandedModules.has(module.moduleKey);
                      const viewState = getModulePermissionState(module.moduleKey, 'can_view');
                      const executeState = getModulePermissionState(module.moduleKey, 'can_execute');
                      const hasViewTopics = module.topics.some(t => t.hasView);
                      const hasExecuteTopics = module.topics.some(t => t.hasExecute);
                      
                      return (
                        <Collapsible 
                          key={module.moduleKey}
                          open={isExpanded}
                          onOpenChange={() => toggleModule(module.moduleKey)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="font-medium">{module.moduleLabel}</span>
                                <Badge variant="outline" className="text-xs">
                                  {module.topics.length} funcionalidades
                                </Badge>
                              </div>
                              <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
                                {hasViewTopics && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Ver</span>
                                    <Checkbox
                                      checked={viewState === true}
                                      ref={(el) => {
                                        if (el && viewState === 'indeterminate') {
                                          el.dataset.state = 'indeterminate';
                                        }
                                      }}
                                      onCheckedChange={(checked) => 
                                        handleModuleToggleAll(module.moduleKey, 'can_view', checked === true)
                                      }
                                    />
                                  </div>
                                )}
                                {hasExecuteTopics && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Executar</span>
                                    <Checkbox
                                      checked={executeState === true}
                                      ref={(el) => {
                                        if (el && executeState === 'indeterminate') {
                                          el.dataset.state = 'indeterminate';
                                        }
                                      }}
                                      onCheckedChange={(checked) => 
                                        handleModuleToggleAll(module.moduleKey, 'can_execute', checked === true)
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="bg-muted/30 border-t">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-12">Funcionalidade</TableHead>
                                    <TableHead className="w-32 text-center">Ver</TableHead>
                                    <TableHead className="w-32 text-center">Executar</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {module.topics.map((topic) => {
                                    const perm = permissions.find(
                                      p => p.module_key === module.moduleKey && p.topic_key === topic.key
                                    );
                                    
                                    return (
                                      <TableRow key={topic.key} className="hover:bg-muted/50">
                                        <TableCell className="pl-12">
                                          <div>
                                            <span className="font-medium">{topic.label}</span>
                                            <p className="text-xs text-muted-foreground">{topic.description}</p>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {topic.hasView ? (
                                            <Checkbox
                                              checked={perm?.can_view || false}
                                              onCheckedChange={(checked) => 
                                                handlePermissionChange(
                                                  module.moduleKey, 
                                                  topic.key, 
                                                  'can_view', 
                                                  checked === true
                                                )
                                              }
                                            />
                                          ) : (
                                            <span className="text-muted-foreground">—</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {topic.hasExecute ? (
                                            <Checkbox
                                              checked={perm?.can_execute || false}
                                              onCheckedChange={(checked) => 
                                                handlePermissionChange(
                                                  module.moduleKey, 
                                                  topic.key, 
                                                  'can_execute', 
                                                  checked === true
                                                )
                                              }
                                            />
                                          ) : (
                                            <span className="text-muted-foreground">—</span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>

                {/* Support Departments Section */}
                {activeDepartments.length > 0 && (
                  <div>
                    <Label className="text-base font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Departamentos de Suporte
                    </Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Selecione quais departamentos de suporte este grupo pode visualizar e gerir
                    </p>
                    <div className="border rounded-lg p-4 space-y-3">
                      {activeDepartments.map((dept) => (
                        <div key={dept.id} className="flex items-center gap-3">
                          <Checkbox
                            id={`dept-${dept.id}`}
                            checked={selectedDepartments.has(dept.id)}
                            onCheckedChange={(checked) => 
                              handleDepartmentToggle(dept.id, checked === true)
                            }
                          />
                          <Label 
                            htmlFor={`dept-${dept.id}`} 
                            className="cursor-pointer font-normal"
                          >
                            {dept.name}
                          </Label>
                        </div>
                      ))}
                      {selectedDepartments.size === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Sem departamentos selecionados - este grupo não terá acesso a tickets de suporte com departamento atribuído
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCloseDialog} disabled={isSaving}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button variant="gold" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSaving ? "A guardar..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGroupsManager;
