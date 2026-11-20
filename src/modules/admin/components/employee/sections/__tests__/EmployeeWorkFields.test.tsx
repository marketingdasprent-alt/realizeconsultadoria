import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmployeeWorkFields } from '../EmployeeWorkFields';

vi.mock('../../CatalogCombobox', () => ({ CatalogCombobox: () => <div /> }));
// O Responsável direto lê os colaboradores do servidor; aqui só interessa a empresa.
vi.mock('../ManagerSelect', () => ({ ManagerSelect: () => <div /> }));

const base = {
  register: () => ({}) as never,
  setValue: vi.fn(),
  errors: {},
  companyId: 'c1',
  companies: [{ id: 'c1', name: 'Alfa, Lda' }],
  position: '',
  department: '',
  employeeId: null,
  managerId: '',
};

const renderFields = (props: Partial<Parameters<typeof EmployeeWorkFields>[0]> = {}) =>
  render(
    <MemoryRouter>
      <EmployeeWorkFields {...base} {...props} />
    </MemoryRouter>
  );

describe('EmployeeWorkFields: empresa', () => {
  it('ao criar mostra o seletor de empresa', () => {
    renderFields();
    expect(screen.getByText('Empresa *')).toBeTruthy();
    expect(screen.queryByText('Mover para empresa…')).toBeNull();
  });

  it('em edição mostra a empresa só de leitura, sem seletor', () => {
    renderFields({ currentCompany: { name: 'Alfa, Lda' } });
    expect(screen.queryByText('Empresa *')).toBeNull();
    expect(screen.getByText('Alfa, Lda')).toBeTruthy();
    expect(screen.getByText(/Para mudar de empresa/)).toBeTruthy();
  });

  it('em edição sem permissão para mover não há atalho', () => {
    renderFields({ currentCompany: { name: 'Alfa, Lda' } });
    expect(screen.queryByText('Mover para empresa…')).toBeNull();
  });

  it('em edição, com permissão, o atalho abre a ação "Mover para empresa…"', () => {
    const onMove = vi.fn();
    renderFields({ currentCompany: { name: 'Alfa, Lda', onMove } });
    fireEvent.click(screen.getByText('Mover para empresa…'));
    expect(onMove).toHaveBeenCalledTimes(1);
  });
});
