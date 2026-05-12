import { useState, useEffect, useCallback } from 'react';
import {
  companyService,
  type Company,
  type CompanyInsert,
  type CompanyUpdate,
} from '@/modules/admin/services/companyService';

interface UseCompaniesResult {
  companies: Company[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createCompany: (company: CompanyInsert) => Promise<{ data: Company | null; error: any }>;
  updateCompany: (
    id: string,
    company: CompanyUpdate
  ) => Promise<{ data: Company | null; error: any }>;
  deleteCompany: (id: string) => Promise<{ success: boolean; error: any }>;
  toggleStatus: (id: string, isActive: boolean) => Promise<{ data: Company | null; error: any }>;
}

export const useCompanies = (): UseCompaniesResult => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await companyService.getAll();

    if (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Erro ao carregar empresas');
    } else {
      setCompanies(data ?? []);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const createCompany = async (company: CompanyInsert) => {
    const result = await companyService.create(company);
    if (!result.error) await fetchCompanies();
    return result;
  };

  const updateCompany = async (id: string, company: CompanyUpdate) => {
    const result = await companyService.update(id, company);
    if (!result.error) {
      setCompanies(prev => prev.map(c => (c.id === id ? { ...c, ...result.data } : c)));
    }
    return result;
  };

  const deleteCompany = async (id: string) => {
    const result = await companyService.delete(id);
    if (result.success) {
      setCompanies(prev => prev.filter(c => c.id !== id));
    }
    return result;
  };

  const toggleStatus = async (id: string, isActive: boolean) => {
    const result = await companyService.toggleActive(id, isActive);
    if (!result.error) {
      setCompanies(prev => prev.map(c => (c.id === id ? { ...c, is_active: isActive } : c)));
    }
    return result;
  };

  return {
    companies,
    isLoading,
    error,
    refetch: fetchCompanies,
    createCompany,
    updateCompany,
    deleteCompany,
    toggleStatus,
  };
};
