import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCompanies } from '../useCompanies';

// Mock do companyService
vi.mock('@/modules/admin/services/companyService', () => ({
  companyService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggleActive: vi.fn(),
  },
}));

import { companyService } from '@/modules/admin/services/companyService';

describe('useCompanies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    vi.mocked(companyService.getAll).mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useCompanies());
    // O estado inicial deve ser true antes do primeiro useEffect
    expect(result.current.isLoading).toBe(true);
  });

  it('should fetch companies on mount', async () => {
    const mockCompanies = [
      { id: '1', name: 'Company A' },
      { id: '2', name: 'Company B' },
    ];

    vi.mocked(companyService.getAll).mockResolvedValue({
      data: mockCompanies as any,
      error: null,
    });

    const { result } = renderHook(() => useCompanies());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.companies).toEqual(mockCompanies);
    expect(result.current.error).toBeNull();
    expect(companyService.getAll).toHaveBeenCalled();
  });

  it('should handle fetch error', async () => {
    const mockError = new Error('Fetch error');

    vi.mocked(companyService.getAll).mockResolvedValue({
      data: null,
      error: mockError,
    });

    const { result } = renderHook(() => useCompanies());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.companies).toEqual([]);
    expect(result.current.error).toBe('Fetch error');
  });

  it('should refetch companies', async () => {
    const mockCompanies = [{ id: '1', name: 'Company A' }];

    vi.mocked(companyService.getAll).mockResolvedValue({
      data: mockCompanies as any,
      error: null,
    });

    const { result } = renderHook(() => useCompanies());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(companyService.getAll).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(companyService.getAll).toHaveBeenCalledTimes(2);
  });

  it('should create a new company', async () => {
    const newCompany = { name: 'New Company' };
    const createdCompany = { id: '3', ...newCompany } as any;

    vi.mocked(companyService.getAll).mockResolvedValue({
      data: [{ id: '1', name: 'Company A' }],
      error: null,
    });

    vi.mocked(companyService.create).mockResolvedValue({
      data: createdCompany,
      error: null,
    });

    const { result } = renderHook(() => useCompanies());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let createResult;
    await act(async () => {
      createResult = await result.current.createCompany(newCompany as any);
    });

    expect(createResult.data).toEqual(createdCompany);
    expect(createResult.error).toBeNull();
    expect(companyService.create).toHaveBeenCalledWith(newCompany);
  });

  it('should handle create company error', async () => {
    const mockError = new Error('Create error');

    vi.mocked(companyService.getAll).mockResolvedValue({
      data: [],
      error: null,
    });

    vi.mocked(companyService.create).mockResolvedValue({
      data: null,
      error: mockError,
    });

    const { result } = renderHook(() => useCompanies());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let createResult;
    await act(async () => {
      createResult = await result.current.createCompany({ name: 'Test' } as any);
    });

    expect(createResult.error).toBeDefined();
    expect(createResult.data).toBeNull();
  });

  it('should update a company', async () => {
    const updatedCompany = { id: '1', name: 'Updated Company' } as any;
    const updateData = { name: 'Updated Company' };

    vi.mocked(companyService.getAll).mockResolvedValue({
      data: [{ id: '1', name: 'Original Company' }],
      error: null,
    });

    vi.mocked(companyService.update).mockResolvedValue({
      data: updatedCompany,
      error: null,
    });

    const { result } = renderHook(() => useCompanies());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let updateResult;
    await act(async () => {
      updateResult = await result.current.updateCompany('1', updateData as any);
    });

    expect(updateResult.data).toEqual(updatedCompany);
    expect(updateResult.error).toBeNull();
    expect(companyService.update).toHaveBeenCalledWith('1', updateData);
  });

  it('should delete a company', async () => {
    vi.mocked(companyService.getAll).mockResolvedValue({
      data: [{ id: '1', name: 'Company A' }],
      error: null,
    });

    vi.mocked(companyService.delete).mockResolvedValue({
      success: true,
      error: null,
    });

    const { result } = renderHook(() => useCompanies());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let deleteResult;
    await act(async () => {
      deleteResult = await result.current.deleteCompany('1');
    });

    expect(deleteResult.success).toBe(true);
    expect(deleteResult.error).toBeNull();
    expect(companyService.delete).toHaveBeenCalledWith('1');
  });

  it('should toggle company status', async () => {
    const toggledCompany = { id: '1', name: 'Company A', is_active: false } as any;

    vi.mocked(companyService.getAll).mockResolvedValue({
      data: [{ id: '1', name: 'Company A', is_active: true }],
      error: null,
    });

    vi.mocked(companyService.toggleActive).mockResolvedValue({
      data: toggledCompany,
      error: null,
    });

    const { result } = renderHook(() => useCompanies());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let toggleResult;
    await act(async () => {
      toggleResult = await result.current.toggleStatus('1', false);
    });

    expect(toggleResult.data).toEqual(toggledCompany);
    expect(companyService.toggleActive).toHaveBeenCalledWith('1', false);
  });

  it('should return expected interface', async () => {
    vi.mocked(companyService.getAll).mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useCompanies());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toHaveProperty('companies');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refetch');
    expect(result.current).toHaveProperty('createCompany');
    expect(result.current).toHaveProperty('updateCompany');
    expect(result.current).toHaveProperty('deleteCompany');
    expect(result.current).toHaveProperty('toggleStatus');
  });
});
