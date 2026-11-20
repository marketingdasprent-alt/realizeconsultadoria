import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ManagerSelect } from '../ManagerSelect';

// Empresa c1 (só ativos): Marta > Ana > Rui; Luís sem chefia. A consulta filtra empresa e ativos.
const { calls } = vi.hoisted(() => ({ calls: [] as [string, string][] }));
vi.mock('@/integrations/supabase/client', () => {
  const people = [
    { id: 'marta', name: 'Marta', position: 'Diretora', manager_id: null },
    { id: 'ana', name: 'Ana', position: 'Coordenadora', manager_id: 'marta' },
    { id: 'rui', name: 'Rui', position: 'Motorista', manager_id: 'ana' },
    { id: 'luis', name: 'Luís', position: null, manager_id: null },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cadeia simulada do cliente
  const builder: any = {
    select: () => builder,
    eq: (col: string, val: string) => (calls.push([col, val]), builder),
    then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: people, error: null }).then(ok),
  };
  return { supabase: { from: () => builder } };
});

const renderSelect = (props: Partial<React.ComponentProps<typeof ManagerSelect>> = {}) => {
  const onChange = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ManagerSelect companyId="c1" employeeId="ana" value="" onChange={onChange} {...props} />
    </QueryClientProvider>
  );
  return { onChange };
};

const openWithKeyboard = async () => {
  const user = userEvent.setup();
  await user.tab();
  expect(screen.getByRole('combobox')).toHaveFocus();
  await user.keyboard('{Enter}');
  return user;
};

describe('ManagerSelect (Responsável direto)', () => {
  it('só ativos da mesma empresa, sem a própria pessoa nem quem está abaixo dela', async () => {
    renderSelect();
    await openWithKeyboard();
    const list = await screen.findByRole('listbox', { name: 'Responsável direto' });
    await within(list).findByText('Marta');
    const names = within(list)
      .getAllByRole('option')
      .map(o => o.textContent);
    expect(names.some(n => n?.includes('Sem responsável direto'))).toBe(true);
    expect(names.some(n => n?.includes('Ana'))).toBe(false);
    expect(names.some(n => n?.includes('Rui'))).toBe(false);
    expect(calls).toEqual(
      expect.arrayContaining([
        ['company_id', 'c1'],
        ['is_active', true],
      ])
    );
  });

  it('pesquisa com foco no campo e escolhe com o teclado', async () => {
    const { onChange } = renderSelect();
    const user = await openWithKeyboard();
    const search = await screen.findByRole('textbox', { name: 'Procurar responsável direto' });
    expect(search).toHaveFocus();
    await user.keyboard('luis');
    await screen.findByRole('option', { name: /Luís/ });
    expect(screen.queryByRole('option', { name: /Marta/ })).toBeNull();
    expect(screen.queryByRole('option', { name: /Sem responsável/ })).toBeNull();
    await user.tab();
    expect(screen.getByRole('option', { name: /Luís/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('luis');
  });

  it('pesquisa sem resultados mostra mensagem', async () => {
    renderSelect();
    const user = await openWithKeyboard();
    await screen.findByRole('textbox', { name: 'Procurar responsável direto' });
    await user.keyboard('zzz');
    expect(await screen.findByText('Ninguém com esse nome nesta empresa.')).toBeInTheDocument();
  });

  it('alcance de equipa: só a lista permitida e sem «Sem responsável direto»', async () => {
    renderSelect({ employeeId: null, allowedIds: new Set(['marta']) });
    await openWithKeyboard();
    const list = await screen.findByRole('listbox');
    await within(list).findByText('Marta');
    const names = within(list)
      .getAllByRole('option')
      .map(o => o.textContent);
    expect(names).toHaveLength(1);
    expect(names[0]).toContain('Marta');
  });

  it('sem empresa: botão desativado a pedir a empresa', () => {
    renderSelect({ companyId: '' });
    expect(screen.getByRole('button', { name: 'Escolha primeiro a empresa' })).toBeDisabled();
  });

  it('mostra o nome do responsável atual', async () => {
    renderSelect({ value: 'marta' });
    expect(await within(screen.getByRole('combobox')).findByText('Marta')).toBeInTheDocument();
  });

  it('o campo da ficha tem o nome «Responsável direto»', async () => {
    const { Field } = await import('../../FormSection');
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Field label="Responsável direto" htmlFor="employee-manager">
          <ManagerSelect
            id="employee-manager"
            companyId="c1"
            employeeId={null}
            value=""
            onChange={() => {}}
          />
        </Field>
      </QueryClientProvider>
    );
    expect(screen.getByRole('combobox', { name: 'Responsável direto' })).toBeInTheDocument();
  });
});
