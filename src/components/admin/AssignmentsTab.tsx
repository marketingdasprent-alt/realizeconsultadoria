import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { getLogoBase64, getLogoHeaderHtml } from "@/lib/logo-utils";
import {
  Plus,
  Search,
  FileText,
  Printer,
  CheckCircle,
  Edit,
  Key,
  X,
} from "lucide-react";

const AssignmentsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canExecuteTopic } = useAdminPermissions();
  const canManage = canExecuteTopic("accesses", "assignments");

  const [open, setOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedPhones, setSelectedPhones] = useState<Record<string, string>>({});
  const [accessories, setAccessories] = useState<Record<string, any>>({});
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [finalConfirmOpen, setFinalConfirmOpen] = useState(false);
  const [selectedAssignmentForReturn, setSelectedAssignmentForReturn] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "returned">("active");
  const [keysCount, setKeysCount] = useState<string>("");
  const [keysLocations, setKeysLocations] = useState<string[]>([]);

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, email, company_id, is_active, document_number")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch companies
  const { data: companies = [] } = useQuery({
    queryKey: ["companies-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, nif")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch available equipment (when dialog is open)
  const { data: availableEquipment = [] } = useQuery({
    queryKey: ["available-equipment-assignments", editingAssignment?.id],
    queryFn: async () => {
      let query = supabase
        .from("equipments")
        .select("*, equipment_categories(name)");

      if (editingAssignment) {
        // Include already assigned items for this assignment
        const { data: assignedItems } = await supabase
          .from("assignment_items")
          .select("equipment_id")
          .eq("assignment_id", editingAssignment.id);
        const assignedIds = assignedItems?.map((i: any) => i.equipment_id) || [];
        if (assignedIds.length > 0) {
          query = query.or(`status.eq.available,id.in.(${assignedIds.join(",")})`);
        } else {
          query = query.eq("status", "available");
        }
      } else {
        query = query.eq("status", "available");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch available phones (SIM cards)
  const { data: availablePhones = [] } = useQuery({
    queryKey: ["available-phones-assignments", editingAssignment?.id],
    queryFn: async () => {
      // Get all phones, we'll filter by availability
      const { data: allPhones, error } = await supabase
        .from("phones")
        .select("*")
        .order("phone_number");
      if (error) throw error;

      if (editingAssignment) {
        const { data: assignedItems } = await supabase
          .from("assignment_items")
          .select("phone_id")
          .eq("assignment_id", editingAssignment.id)
          .not("phone_id", "is", null);
        const assignedPhoneIds = assignedItems?.map((i: any) => i.phone_id) || [];
        // Show phones not assigned to other employees OR assigned to this assignment
        return allPhones?.filter(
          (p: any) => !p.employee_id || assignedPhoneIds.includes(p.id)
        ) || [];
      }
      // Show phones without employee_id (available)
      return allPhones?.filter((p: any) => !p.employee_id) || [];
    },
    enabled: open,
  });

  // Fetch assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select(`
          *,
          employees(name, document_number),
          companies(name, nif),
          assignment_items(
            *,
            equipments:equipment_id(*, equipment_categories(name)),
            phones:phone_id(*)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).sort((a: any, b: any) => {
        const nameA = a.employees?.name?.toLowerCase() || "";
        const nameB = b.employees?.name?.toLowerCase() || "";
        return nameA.localeCompare(nameB, "pt-PT");
      });
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const employee = employees.find((e) => e.id === selectedEmployee);
      if (!employee) throw new Error("Colaborador não encontrado");

      const { data: assignment, error: assignmentError } = await supabase
        .from("assignments")
        .insert({
          employee_id: selectedEmployee,
          company_id: employee.company_id,
          status: "active",
          keys_count: keysCount ? parseInt(keysCount) : null,
          keys_locations: keysLocations.filter((loc) => loc.trim() !== ""),
        })
        .select()
        .single();

      if (assignmentError) throw assignmentError;

      const items = selectedEquipment.map((equipId) => {
        const equip = availableEquipment.find((e: any) => e.id === equipId);
        const categoryName = equip?.equipment_categories?.name;

        const item: any = {
          assignment_id: assignment.id,
          equipment_id: equipId,
        };

        if (categoryName === "Telemóvel") {
          item.phone_id = selectedPhones[equipId] || null;
          item.has_charger = accessories[equipId]?.charger || false;
          item.has_case = accessories[equipId]?.case || false;
          item.has_screen_protector = accessories[equipId]?.screen_protector || false;
        }
        if (categoryName === "Portátil") {
          item.has_charger = accessories[equipId]?.charger || false;
          item.has_bag = accessories[equipId]?.bag || false;
          item.has_mouse_pad = accessories[equipId]?.mouse_pad || false;
          item.has_keyboard = accessories[equipId]?.keyboard || false;
          item.has_mouse = accessories[equipId]?.mouse || false;
        }
        if (categoryName === "Tablet") {
          item.has_charger = accessories[equipId]?.charger || false;
          item.has_case = accessories[equipId]?.case || false;
          item.has_screen_protector = accessories[equipId]?.screen_protector || false;
          item.has_pen = accessories[equipId]?.pen || false;
        }

        return item;
      });

      const { error: itemsError } = await supabase
        .from("assignment_items")
        .insert(items);
      if (itemsError) throw itemsError;

      // Update equipment status to assigned
      await supabase
        .from("equipments")
        .update({ status: "assigned" })
        .in("id", selectedEquipment);

      // Update phones employee_id
      const phoneIds = Object.values(selectedPhones).filter(Boolean);
      if (phoneIds.length > 0) {
        await supabase
          .from("phones")
          .update({ employee_id: selectedEmployee })
          .in("id", phoneIds);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["available-equipment-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["equipments"] });
      toast({ title: "Atribuição criada com sucesso!" });
      resetDialogState();
    },
    onError: () => {
      toast({ title: "Erro ao criar atribuição", variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const assignmentId = editingAssignment.id;
      const oldItems = editingAssignment.assignment_items || [];
      const oldEquipmentIds = oldItems.map((i: any) => i.equipment_id);
      const removedEquipmentIds = oldEquipmentIds.filter((id: string) => !selectedEquipment.includes(id));
      const newEquipmentIds = selectedEquipment.filter((id: string) => !oldEquipmentIds.includes(id));

      // Free removed equipment
      if (removedEquipmentIds.length > 0) {
        await supabase
          .from("assignment_items")
          .delete()
          .eq("assignment_id", assignmentId)
          .in("equipment_id", removedEquipmentIds);

        await supabase
          .from("equipments")
          .update({ status: "available" })
          .in("id", removedEquipmentIds);

        // Free removed phones
        const removedPhoneIds = oldItems
          .filter((i: any) => removedEquipmentIds.includes(i.equipment_id) && i.phone_id)
          .map((i: any) => i.phone_id);
        if (removedPhoneIds.length > 0) {
          await supabase
            .from("phones")
            .update({ employee_id: null })
            .in("id", removedPhoneIds);
        }
      }

      // Add new equipment
      if (newEquipmentIds.length > 0) {
        const newItems = newEquipmentIds.map((equipId: string) => {
          const equip = availableEquipment.find((e: any) => e.id === equipId);
          const categoryName = equip?.equipment_categories?.name;
          const item: any = { assignment_id: assignmentId, equipment_id: equipId };

          if (categoryName === "Telemóvel") {
            item.phone_id = selectedPhones[equipId] || null;
            item.has_charger = accessories[equipId]?.charger || false;
            item.has_case = accessories[equipId]?.case || false;
            item.has_screen_protector = accessories[equipId]?.screen_protector || false;
          }
          if (categoryName === "Portátil") {
            item.has_charger = accessories[equipId]?.charger || false;
            item.has_bag = accessories[equipId]?.bag || false;
            item.has_mouse_pad = accessories[equipId]?.mouse_pad || false;
            item.has_keyboard = accessories[equipId]?.keyboard || false;
            item.has_mouse = accessories[equipId]?.mouse || false;
          }
          if (categoryName === "Tablet") {
            item.has_charger = accessories[equipId]?.charger || false;
            item.has_case = accessories[equipId]?.case || false;
            item.has_screen_protector = accessories[equipId]?.screen_protector || false;
            item.has_pen = accessories[equipId]?.pen || false;
          }
          return item;
        });

        await supabase.from("assignment_items").insert(newItems);
        await supabase
          .from("equipments")
          .update({ status: "assigned" })
          .in("id", newEquipmentIds);

        const newPhoneIds = Object.entries(selectedPhones)
          .filter(([equipId]) => newEquipmentIds.includes(equipId))
          .map(([, phoneId]) => phoneId)
          .filter(Boolean);
        if (newPhoneIds.length > 0) {
          await supabase
            .from("phones")
            .update({ employee_id: editingAssignment.employee_id })
            .in("id", newPhoneIds);
        }
      }

      // Update existing items accessories
      const existingEquipmentIds = selectedEquipment.filter((id: string) => oldEquipmentIds.includes(id));
      for (const equipId of existingEquipmentIds) {
        const equip = availableEquipment.find((e: any) => e.id === equipId);
        const categoryName = equip?.equipment_categories?.name;
        const updateData: any = {};

        if (categoryName === "Telemóvel") {
          const oldItem = oldItems.find((i: any) => i.equipment_id === equipId);
          const newPhoneId = selectedPhones[equipId];
          if (oldItem?.phone_id !== newPhoneId) {
            if (oldItem?.phone_id) {
              await supabase.from("phones").update({ employee_id: null }).eq("id", oldItem.phone_id);
            }
            if (newPhoneId) {
              await supabase.from("phones").update({ employee_id: editingAssignment.employee_id }).eq("id", newPhoneId);
            }
            updateData.phone_id = newPhoneId || null;
          }
          updateData.has_charger = accessories[equipId]?.charger || false;
          updateData.has_case = accessories[equipId]?.case || false;
          updateData.has_screen_protector = accessories[equipId]?.screen_protector || false;
        }
        if (categoryName === "Portátil") {
          updateData.has_charger = accessories[equipId]?.charger || false;
          updateData.has_bag = accessories[equipId]?.bag || false;
          updateData.has_mouse_pad = accessories[equipId]?.mouse_pad || false;
          updateData.has_keyboard = accessories[equipId]?.keyboard || false;
          updateData.has_mouse = accessories[equipId]?.mouse || false;
        }
        if (categoryName === "Tablet") {
          updateData.has_charger = accessories[equipId]?.charger || false;
          updateData.has_case = accessories[equipId]?.case || false;
          updateData.has_screen_protector = accessories[equipId]?.screen_protector || false;
          updateData.has_pen = accessories[equipId]?.pen || false;
        }

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from("assignment_items")
            .update(updateData)
            .eq("assignment_id", assignmentId)
            .eq("equipment_id", equipId);
        }
      }

      await supabase
        .from("assignments")
        .update({
          keys_count: keysCount ? parseInt(keysCount) : null,
          keys_locations: keysLocations.filter((loc) => loc.trim() !== ""),
        })
        .eq("id", assignmentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["available-equipment-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["equipments"] });
      toast({ title: "Atribuição atualizada com sucesso!" });
      resetDialogState();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar atribuição", variant: "destructive" });
    },
  });

  // Return mutation
  const returnMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const assignment = assignments.find((a: any) => a.id === assignmentId);

      await supabase
        .from("assignments")
        .update({ status: "returned", return_date: new Date().toISOString().split("T")[0] })
        .eq("id", assignmentId);

      const equipmentIds = assignment?.assignment_items?.map((i: any) => i.equipment_id) || [];
      if (equipmentIds.length > 0) {
        await supabase.from("equipments").update({ status: "available" }).in("id", equipmentIds);
      }

      const phoneIds = assignment?.assignment_items
        ?.map((i: any) => i.phone_id)
        .filter(Boolean) || [];
      if (phoneIds.length > 0) {
        await supabase.from("phones").update({ employee_id: null }).in("id", phoneIds);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["available-equipment-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["equipments"] });
      toast({ title: "Atribuição devolvida com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao devolver atribuição", variant: "destructive" });
    },
  });

  const resetDialogState = () => {
    setOpen(false);
    setEditingAssignment(null);
    setSelectedEmployee("");
    setSelectedEquipment([]);
    setSelectedPhones({});
    setAccessories({});
    setKeysCount("");
    setKeysLocations([]);
  };

  const handleEdit = (assignment: any) => {
    setEditingAssignment(assignment);
    setSelectedEmployee(assignment.employee_id);
    const equipIds = assignment.assignment_items?.map((i: any) => i.equipment_id) || [];
    setSelectedEquipment(equipIds);

    const phones: Record<string, string> = {};
    const acc: Record<string, any> = {};
    assignment.assignment_items?.forEach((i: any) => {
      if (i.phone_id) phones[i.equipment_id] = i.phone_id;
      acc[i.equipment_id] = {
        charger: i.has_charger,
        case: i.has_case,
        screen_protector: i.has_screen_protector,
        bag: i.has_bag,
        mouse_pad: i.has_mouse_pad,
        keyboard: i.has_keyboard,
        mouse: i.has_mouse,
        pen: i.has_pen,
      };
    });
    setSelectedPhones(phones);
    setAccessories(acc);
    setKeysCount(assignment.keys_count?.toString() || "");
    setKeysLocations(assignment.keys_locations || []);
    setOpen(true);
  };

  const handleSubmit = () => {
    if (editingAssignment) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const addKeyLocation = () => setKeysLocations([...keysLocations, ""]);
  const removeKeyLocation = (index: number) =>
    setKeysLocations(keysLocations.filter((_, i) => i !== index));
  const updateKeyLocation = (index: number, value: string) => {
    const updated = [...keysLocations];
    updated[index] = value;
    setKeysLocations(updated);
  };

  const showKeysLocations = keysCount !== "" && keysCount.length > 0;

  // Group equipment by category
  const groupedEquipment = availableEquipment.reduce((acc: any, equip: any) => {
    const categoryName = equip.equipment_categories?.name || "Outro";
    if (!acc[categoryName]) acc[categoryName] = [];
    acc[categoryName].push(equip);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedCategories = Object.keys(groupedEquipment).sort();

  const formatPhoneNumber = (num: string) => {
    if (!num) return "";
    const clean = num.replace(/\D/g, "");
    if (clean.length === 9) return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
    return num;
  };

  // Print functions
  const handlePrint = async (assignment: any, isReturn = false) => {
    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({ title: "Erro ao imprimir", description: "Verifique se pop-ups estão bloqueados.", variant: "destructive" });
        return;
      }

      const logoBase64 = await getLogoBase64();
      const employee = assignment.employees;
      const company = assignment.companies;
      const items = assignment.assignment_items || [];

      const mobileItems = items.filter((i: any) => i.equipments?.equipment_categories?.name === "Telemóvel");
      const laptopItems = items.filter((i: any) => i.equipments?.equipment_categories?.name === "Portátil");
      const tabletItems = items.filter((i: any) => i.equipments?.equipment_categories?.name === "Tablet");
      const monitorItems = items.filter((i: any) => i.equipments?.equipment_categories?.name === "Monitor");

      const buildTable = (categoryItems: any[], category: string) => {
        if (categoryItems.length === 0) return "";
        return `<div class="category-title">${category}:</div>` + categoryItems.map((item: any) => {
          const equip = item.equipments;
          const phone = item.phones;
          if (category === "Telemóvel") {
            return `<table><tr>
              <td><strong>Marca:</strong> ${equip?.brand || ""} ${equip?.model || ""}</td>
              <td><strong>Nº:</strong> ${phone?.phone_number ? formatPhoneNumber(phone.phone_number) : "N/A"}</td>
              <td><strong>PIN:</strong> ${phone?.pin || "N/A"}</td>
            </tr><tr>
              <td><strong>Passe:</strong> ${equip?.pass_year || "N/A"}</td>
              <td><strong>Nº Série:</strong> ${equip?.serial_number || "N/A"}</td>
              <td><strong>PUK:</strong> ${phone?.puk || "N/A"}</td>
            </tr><tr>
              <td><strong>CAPA:</strong> ${item.has_case ? "SIM" : "NÃO"}</td>
              <td><strong>CARREGADOR:</strong> ${item.has_charger ? "SIM" : "NÃO"}</td>
              <td><strong>PELÍCULA:</strong> ${item.has_screen_protector ? "SIM" : "NÃO"}</td>
            </tr></table>`;
          }
          if (category === "Portátil") {
            return `<table><tr>
              <td><strong>Marca:</strong> ${equip?.brand || ""} ${equip?.model || ""}</td>
              <td><strong>PASSE:</strong> ${equip?.pass_year || "Sem"}</td>
              <td><strong>Nº Série:</strong> ${equip?.serial_number || "N/A"}</td>
            </tr><tr>
              <td><strong>RATO:</strong> ${item.has_mouse ? "SIM" : "NÃO"}</td>
              <td><strong>TAPETE:</strong> ${item.has_mouse_pad ? "SIM" : "NÃO"}</td>
              <td><strong>TECLADO:</strong> ${item.has_keyboard ? "SIM" : "NÃO"}</td>
            </tr><tr>
              <td><strong>MALA:</strong> ${item.has_bag ? "SIM" : "NÃO"}</td>
              <td><strong>CARREGADOR:</strong> ${item.has_charger ? "SIM" : "NÃO"}</td>
              <td></td>
            </tr></table>`;
          }
          if (category === "Tablet") {
            return `<table><tr>
              <td><strong>Marca:</strong> ${equip?.brand || ""} ${equip?.model || ""}</td>
              <td><strong>PASSE:</strong> ${equip?.pass_year || "N/A"}</td>
              <td><strong>Nº Série:</strong> ${equip?.serial_number || "N/A"}</td>
            </tr><tr>
              <td><strong>CAPA:</strong> ${item.has_case ? "SIM" : "NÃO"}</td>
              <td><strong>CARREGADOR:</strong> ${item.has_charger ? "SIM" : "NÃO"}</td>
              <td><strong>PELÍCULA:</strong> ${item.has_screen_protector ? "SIM" : "NÃO"}</td>
            </tr><tr>
              <td><strong>CANETA:</strong> ${item.has_pen ? "SIM" : "NÃO"}</td>
              <td></td><td></td>
            </tr></table>`;
          }
          // Monitor or other
          return `<table><tr>
            <td><strong>Marca:</strong> ${equip?.brand || ""} ${equip?.model || ""}</td>
            <td><strong>Nº Série:</strong> ${equip?.serial_number || "N/A"}</td>
            <td><strong>CARREGADOR:</strong> ${item.has_charger ? "SIM" : "NÃO"}</td>
          </tr></table>`;
        }).join("");
      };

      const title = isReturn
        ? "DECLARAÇÃO DE DEVOLUÇÃO DE EQUIPAMENTOS"
        : "DECLARAÇÃO DE ENTREGA DE EQUIPAMENTOS";

      const declarationText = isReturn
        ? `Eu, ${employee?.name}, portador(a) do documento nº ${employee?.document_number || "N/A"}, declaro que para todos os efeitos que devolvi os equipamentos acima mencionados, em bom estado, para empresa ${company?.name || "N/A"}, com o NIPC ${company?.nif || "N/A"}.`
        : `Eu, ${employee?.name}, portador(a) do documento nº ${employee?.document_number || "N/A"}, declaro que para todos os efeitos, RECEBI os equipamentos acima mencionados, em bom estado, da empresa ${company?.name || "N/A"}, com o NIPC ${company?.nif || "N/A"}.<br/><br/>Importa referir que, comprometo-me a devolver os equipamentos acima citados, com uma hora de antecedência de data de término da atividade laboral, de modo que os serviços informáticos verifiquem as funcionalidades dos mesmos.`;

      const html = `<!DOCTYPE html><html><head><title>${title}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.4; padding: 20px; }
          .logo { text-align: center; margin-bottom: 20px; }
          .logo img { height: 60px; }
          h1 { text-align: center; margin-bottom: 20px; font-size: 16px; }
          .employee-info { margin-bottom: 15px; line-height: 1.6; }
          .category-title { font-weight: bold; margin-top: 15px; margin-bottom: 5px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          table td { border: 1px solid #000; padding: 5px 8px; font-size: 10px; }
          .declaration { margin: 20px 0; text-align: justify; line-height: 1.5; }
          .signature { margin-top: 40px; text-align: center; }
          .signature-line { border-top: 1px solid #000; width: 300px; margin: 40px auto 20px auto; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style></head>
        <body>
          <div class="logo"><img src="${logoBase64}" alt="Realize" /></div>
          <h1>${title}</h1>
          <div class="employee-info">
            <strong>Nome do Colaborador:</strong> ${employee?.name} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <strong>Documento:</strong> ${employee?.document_number || "N/A"}
          </div>
          ${buildTable(mobileItems, "Telemóvel")}
          ${buildTable(laptopItems, "Portátil")}
          ${buildTable(tabletItems, "Tablet")}
          ${buildTable(monitorItems, "Monitor")}
          ${assignment.keys_count && assignment.keys_count > 0 ? `
            <div class="category-title">Chaves:</div>
            <table><tr>
              <td><strong>Quantidade:</strong> ${assignment.keys_count}</td>
              <td><strong>Locais:</strong> ${assignment.keys_locations?.join(", ") || "N/A"}</td>
            </tr></table>
          ` : ""}
          <div class="declaration">${declarationText}</div>
          <div class="signature">
            <div class="signature-line"></div>
            <div style="margin-top: 15px;">
              Leiria, ${new Date().toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}
            </div>
            ${isReturn ? `<div style="margin-top: 30px; font-weight: bold;">RECEBIDO POR:_____________________</div>` : ""}
          </div>
          <script>
            setTimeout(function() { window.print(); window.onafterprint = function() { window.close(); }; }, 300);
          </script>
        </body></html>`;

      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      console.error("Erro ao gerar impressão:", error);
      toast({ title: "Erro ao imprimir", variant: "destructive" });
    }
  };

  // Filter assignments
  const filteredAssignments = assignments.filter((assignment: any) => {
    if (statusFilter !== "all" && assignment.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    if (assignment.employees?.name?.toLowerCase().includes(search)) return true;
    return assignment.assignment_items?.some((item: any) => {
      const brand = item.equipments?.brand;
      const model = item.equipments?.model;
      const catName = item.equipments?.equipment_categories?.name;
      return (
        brand?.toLowerCase().includes(search) ||
        model?.toLowerCase().includes(search) ||
        catName?.toLowerCase().includes(search)
      );
    });
  });

  // Render accessory checkboxes
  const renderAccessories = (equipId: string, category: string) => {
    const accessoryConfigs: Record<string, { key: string; label: string }[]> = {
      "Telemóvel": [
        { key: "charger", label: "Carregador" },
        { key: "case", label: "Capa" },
        { key: "screen_protector", label: "Película" },
      ],
      "Portátil": [
        { key: "charger", label: "Carregador" },
        { key: "bag", label: "Mala" },
        { key: "mouse_pad", label: "Tapete do Rato" },
        { key: "keyboard", label: "Teclado" },
        { key: "mouse", label: "Rato" },
      ],
      "Tablet": [
        { key: "charger", label: "Carregador" },
        { key: "case", label: "Capa" },
        { key: "screen_protector", label: "Película" },
        { key: "pen", label: "Caneta (Stylus)" },
      ],
    };

    const config = accessoryConfigs[category];
    if (!config) return null;

    return (
      <div className="ml-6 space-y-2">
        <Label className="text-sm font-medium">Acessórios</Label>
        <div className="space-y-2">
          {config.map(({ key, label }) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox
                id={`${key}-${equipId}`}
                checked={accessories[equipId]?.[key] || false}
                onCheckedChange={(checked) =>
                  setAccessories({
                    ...accessories,
                    [equipId]: { ...accessories[equipId], [key]: checked },
                  })
                }
              />
              <label htmlFor={`${key}-${equipId}`} className="text-sm">{label}</label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => { resetDialogState(); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Atribuição
          </Button>
        </div>
      )}

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por colaborador ou equipamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="returned">Devolvidas</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assignment cards */}
      <div className="space-y-4">
        {filteredAssignments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhuma atribuição encontrada.
          </p>
        ) : (
          filteredAssignments.map((assignment: any) => (
            <Card key={assignment.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{assignment.employees?.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {assignment.keys_count > 0 && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Key className="h-3 w-3" />
                        {assignment.keys_count} {assignment.keys_count === 1 ? "chave" : "chaves"}
                      </Badge>
                    )}
                    <Badge variant={assignment.status === "active" ? "default" : "secondary"}>
                      {assignment.status === "active" ? "Ativa" : "Devolvida"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Data:</span>{" "}
                    {new Date(assignment.assigned_date).toLocaleDateString("pt-PT")}
                  </p>
                  {assignment.return_date && (
                    <p className="text-sm">
                      <span className="font-medium">Data Devolução:</span>{" "}
                      {new Date(assignment.return_date).toLocaleDateString("pt-PT")}
                    </p>
                  )}
                  <p className="text-sm font-medium">Equipamentos:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    {assignment.assignment_items?.map((item: any) => (
                      <li key={item.id} className="text-sm">
                        {item.equipments?.equipment_categories?.name}
                        {item.equipments?.brand && ` - ${item.equipments.brand}`}
                        {item.equipments?.model && ` ${item.equipments.model}`}
                        {item.equipments?.equipment_categories?.name === "Telemóvel" &&
                          item.phones?.phone_number && (
                            <span className="text-muted-foreground ml-2">
                              ({formatPhoneNumber(item.phones.phone_number)})
                            </span>
                          )}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {assignment.status === "active" && canManage && (
                      <Button size="sm" variant="outline" onClick={() => handleEdit(assignment)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handlePrint(assignment, false)}>
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir
                    </Button>
                    {assignment.status === "active" && canManage && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedAssignmentForReturn(assignment);
                          setReturnConfirmOpen(true);
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Devolver
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetDialogState(); else setOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment
                ? `Editar Atribuição - ${editingAssignment.employees?.name}`
                : "Criar Atribuição"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Employee select */}
            <div className="space-y-2">
              <Label>Colaborador *</Label>
              {editingAssignment ? (
                <div className="p-3 bg-muted rounded-md">
                  <p className="font-medium">{editingAssignment.employees?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Não é possível alterar o colaborador.
                  </p>
                </div>
              ) : (
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Equipment selection */}
            <div className="space-y-2">
              <Label>Equipamentos Disponíveis</Label>
              <div className="max-h-96 overflow-y-auto border rounded-md">
                <Accordion type="multiple" className="w-full">
                  {sortedCategories.map((category) => {
                    const equips = groupedEquipment[category] || [];
                    return (
                      <AccordionItem key={category} value={category}>
                        <AccordionTrigger className="px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{category}</span>
                            <Badge variant="secondary">{equips.length}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 px-4 pb-4">
                            {equips.map((equip: any) => (
                              <div key={equip.id} className="space-y-2 border-b pb-3 last:border-0">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    checked={selectedEquipment.includes(equip.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedEquipment([...selectedEquipment, equip.id]);
                                      } else {
                                        setSelectedEquipment(selectedEquipment.filter((id) => id !== equip.id));
                                      }
                                    }}
                                  />
                                  <Label className="flex-1">
                                    {equip.brand && `${equip.brand}`}
                                    {equip.model && ` ${equip.model}`}
                                    {equip.serial_number && (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ({equip.serial_number})
                                      </span>
                                    )}
                                  </Label>
                                </div>

                                {selectedEquipment.includes(equip.id) && (
                                  <>
                                    {/* SIM card for mobile */}
                                    {equip.equipment_categories?.name === "Telemóvel" && (
                                      <div className="ml-6 space-y-2">
                                        <Label className="text-sm font-medium">Cartão SIM</Label>
                                        <Select
                                          value={selectedPhones[equip.id] || ""}
                                          onValueChange={(value) =>
                                            setSelectedPhones({ ...selectedPhones, [equip.id]: value })
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Selecionar cartão SIM" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {availablePhones.map((phone: any) => (
                                              <SelectItem key={phone.id} value={phone.id}>
                                                {formatPhoneNumber(phone.phone_number)}
                                                {phone.operator && ` - ${phone.operator}`}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                    {renderAccessories(equip.id, equip.equipment_categories?.name)}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </div>

            {/* Keys */}
            <div className="space-y-3 border-t pt-4">
              <Label className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Chaves (opcional)
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="Quantidade de chaves"
                value={keysCount}
                onChange={(e) => setKeysCount(e.target.value)}
              />
              {showKeysLocations && (
                <div className="space-y-2 ml-4">
                  <Label className="text-sm">Locais das Chaves</Label>
                  {keysLocations.map((location, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder={`Local ${index + 1}`}
                        value={location}
                        onChange={(e) => updateKeyLocation(index, e.target.value)}
                        className="flex-1"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeKeyLocation(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addKeyLocation}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Local
                  </Button>
                </div>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={
                !selectedEmployee ||
                selectedEquipment.length === 0 ||
                createMutation.isPending ||
                updateMutation.isPending
              }
              className="w-full"
            >
              {editingAssignment
                ? updateMutation.isPending ? "A atualizar..." : "Atualizar Atribuição"
                : createMutation.isPending ? "A criar..." : "Criar Atribuição"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return confirmation 1 */}
      <AlertDialog open={returnConfirmOpen} onOpenChange={setReturnConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Devolução</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que o colaborador vai devolver os equipamentos?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handlePrint(selectedAssignmentForReturn, true);
                setReturnConfirmOpen(false);
                setTimeout(() => setFinalConfirmOpen(true), 500);
              }}
            >
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return confirmation 2 */}
      <AlertDialog open={finalConfirmOpen} onOpenChange={setFinalConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Devolução Final</AlertDialogTitle>
            <AlertDialogDescription>
              Vai mesmo devolver os equipamentos? Esta ação irá atualizar o status para "disponível".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                returnMutation.mutate(selectedAssignmentForReturn.id);
                setFinalConfirmOpen(false);
                setSelectedAssignmentForReturn(null);
              }}
            >
              SIM
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AssignmentsTab;
