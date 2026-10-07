import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PunchForm } from '../PunchForm';

// O Select do Radix não funciona no jsdom: substitui-se por um <select> nativo.
vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select aria-label="Tipo" value={value} onChange={e => onValueChange(e.target.value)}>
      <option value="">Escolha</option>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

// O Checkbox do Radix mede o tamanho com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const lastIn = { entry_type: 'in', punched_at: new Date().toISOString() };

describe('PunchForm', () => {
  it('only allows registering after choosing the type and confirming', () => {
    const onSubmit = vi.fn();
    const onStart = vi.fn();
    render(<PunchForm lastEntry={lastIn} isBusy={false} onSubmit={onSubmit} onStart={onStart} />);

    const submit = screen.getByRole('button', { name: 'Registar' });
    expect(submit).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeDisabled();

    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo' }), { target: { value: 'out' } });
    expect(onStart).toHaveBeenCalled();
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Observações/), {
      target: { value: '  Saída para almoço  ' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText('Confirmo que quero registar a Saída agora.')).toBeInTheDocument();
    fireEvent.click(submit);

    expect(onSubmit).toHaveBeenCalledWith({ entryType: 'out', note: 'Saída para almoço' });
  });

  it('warns when the chosen type repeats the last record (forgotten punch)', () => {
    render(<PunchForm lastEntry={lastIn} isBusy={false} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Último registo: Entrada hoje às/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo' }), { target: { value: 'in' } });

    expect(screen.getByText(/O seu último registo também foi/)).toBeInTheDocument();
  });
});
