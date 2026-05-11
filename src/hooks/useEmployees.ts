import { useState, useEffect, useCallback } from 'react';
import {
  employeeService,
  type Employee,
  type EmployeeInsert,
  type EmployeeUpdate,
} from '@/modules/admin/services/employeeService';
import { supabase } from '@/integrations/supabase/client';

interface UseEmployeesResult {
  employees: Employee[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createEmployee: (employee: EmployeeInsert) => Promise<{ data: Employee | null; error: any }>;
  updateEmployee: (
    id: string,
    employee: EmployeeUpdate
  ) => Promise<{ data: Employee | null; error: any }>;
  deleteEmployee: (id: string) => Promise<{ success: boolean; error: any }>;
  toggleStatus: (id: string, isActive: boolean) => Promise<{ data: Employee | null; error: any }>;
  resendInvite: (
    employeeId: string,
    employeeName: string
  ) => Promise<{ success: boolean; newPassword?: string; emailSuccess?: boolean; error?: any }>;
}

export const useEmployees = (): UseEmployeesResult => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await employeeService.getAll();

    if (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Erro ao carregar colaboradores');
    } else {
      // @ts-expect-error - The service returns companies relation typed properly, we pass it down
      setEmployees(data ?? []);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const createEmployee = async (employee: EmployeeInsert) => {
    const result = await employeeService.create(employee);
    if (!result.error) await fetchEmployees();
    return result;
  };

  const updateEmployee = async (id: string, employee: EmployeeUpdate) => {
    const result = await employeeService.update(id, employee);
    if (!result.error) await fetchEmployees();
    return result;
  };

  const deleteEmployee = async (id: string) => {
    const result = await employeeService.delete(id);
    if (result.success) {
      setEmployees(prev => prev.filter(e => e.id !== id));
    }
    return result;
  };

  const toggleStatus = async (id: string, isActive: boolean) => {
    const result = await employeeService.toggleActive(id, isActive);
    if (!result.error) {
      setEmployees(prev => prev.map(e => (e.id === id ? { ...e, is_active: isActive } : e)));
    }
    return result;
  };

  const resendInvite = async (employeeId: string, employeeName: string) => {
    try {
      const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
      let newPassword = '';
      for (let i = 0; i < 12; i++) {
        newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const { data: sessionData } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('change-employee-password', {
        body: {
          employee_id: employeeId,
          new_password: newPassword,
          send_email: true,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.success) {
        return {
          success: true,
          newPassword,
          emailSuccess: data.email_success,
        };
      } else {
        throw new Error(data?.error || 'Erro ao re-enviar convite');
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  return {
    employees,
    isLoading,
    error,
    refetch: fetchEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    toggleStatus,
    resendInvite,
  };
};
