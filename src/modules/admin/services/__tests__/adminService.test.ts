import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminService } from '../adminService';

// Mock do supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';

describe('adminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCompanies', () => {
    it('should fetch all companies ordered by name', async () => {
      const mockCompanies = [
        { id: '1', name: 'Company A', created_at: '2026-01-01T00:00:00Z' },
        { id: '2', name: 'Company B', created_at: '2026-01-02T00:00:00Z' },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockCompanies, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await adminService.getCompanies();

      expect(result.data).toEqual(mockCompanies);
      expect(result.error).toBeNull();
      expect(supabase.from).toHaveBeenCalledWith('companies');
      expect(mockQuery.select).toHaveBeenCalledWith('*');
      expect(mockQuery.order).toHaveBeenCalledWith('name');
    });

    it('should return error when query fails', async () => {
      const mockError = new Error('Database error');
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockRejectedValue(mockError),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await adminService.getCompanies();

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('getCompanyById', () => {
    it('should fetch a single company by id', async () => {
      const mockCompany = {
        id: '1',
        name: 'Test Company',
        created_at: '2026-01-01T00:00:00Z',
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCompany, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await adminService.getCompanyById('1');

      expect(result.data).toEqual(mockCompany);
      expect(result.error).toBeNull();
      expect(mockQuery.eq).toHaveBeenCalledWith('id', '1');
    });

    it('should return error for non-existent company', async () => {
      const mockError = new Error('Not found');
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockRejectedValue(mockError),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await adminService.getCompanyById('invalid-id');

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('createCompany', () => {
    it('should create a new company', async () => {
      const newCompany = { name: 'New Company' };
      const createdCompany = { id: '3', ...newCompany, created_at: '2026-05-11T00:00:00Z' };

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createdCompany, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await adminService.createCompany(newCompany as any);

      expect(result.data).toEqual(createdCompany);
      expect(result.error).toBeNull();
      expect(mockQuery.insert).toHaveBeenCalledWith(newCompany);
    });

    it('should return error when creation fails', async () => {
      const newCompany = { name: 'New Company' };
      const mockError = new Error('Insert error');

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockRejectedValue(mockError),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await adminService.createCompany(newCompany as any);

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('getEmployees', () => {
    it('should fetch employees with pagination', async () => {
      const mockEmployees = [
        { id: '1', first_name: 'John', last_name: 'Doe', companies: { name: 'Company A' } },
        { id: '2', first_name: 'Jane', last_name: 'Smith', companies: { name: 'Company B' } },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockEmployees, error: null, count: 2 }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await adminService.getEmployees(1, 20);

      expect(result.data).toEqual(mockEmployees);
      expect(result.count).toBe(2);
      expect(result.error).toBeNull();
      expect(mockQuery.range).toHaveBeenCalledWith(0, 19);
    });

    it('should handle pagination correctly', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      await adminService.getEmployees(2, 20);

      expect(mockQuery.range).toHaveBeenCalledWith(20, 39);
    });
  });

  describe('getEmployeeById', () => {
    it('should fetch employee with company details', async () => {
      const mockEmployee = {
        id: '1',
        first_name: 'John',
        last_name: 'Doe',
        companies: { name: 'Company A' },
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockEmployee, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await adminService.getEmployeeById('1');

      expect(result.data).toEqual(mockEmployee);
      expect(result.error).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle Supabase errors gracefully', async () => {
      const mockError = { message: 'Auth error' };
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ error: mockError, data: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await adminService.getCompanies();

      expect(result.error).toBeDefined();
      expect(result.data).toBeNull();
    });
  });
});
