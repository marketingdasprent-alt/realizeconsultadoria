import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { RemountOnUserChange } from '../RemountOnUserChange';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/contexts/AuthContext';

const setUser = (id: string | null) =>
  vi.mocked(useAuth).mockReturnValue({ user: id ? { id } : null } as ReturnType<typeof useAuth>);

/** Uma página com estado próprio, como as do Workspace (ficha, separadores, escolha de empresa…). */
const Page: React.FC = () => {
  const [name, setName] = useState('Ana (conta anterior)');
  return (
    <button type="button" onClick={() => setName('mexido')}>
      {name}
    </button>
  );
};

const App = () => (
  <RemountOnUserChange>
    <Page />
  </RemountOnUserChange>
);

describe('RemountOnUserChange', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mantém o estado enquanto o utilizador é o mesmo', () => {
    setUser('u1');
    const { rerender } = render(<App />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('mexido');

    setUser('u1');
    rerender(<App />);
    expect(screen.getByRole('button').textContent).toBe('mexido');
  });

  it('outra conta no mesmo separador: o estado da anterior não sobrevive', () => {
    setUser('u1');
    const { rerender } = render(<App />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('mexido');

    setUser('u2');
    rerender(<App />);
    expect(screen.getByRole('button').textContent).toBe('Ana (conta anterior)');
  });

  it('sair e entrar com outra conta também recomeça do zero', () => {
    setUser('u1');
    const { rerender } = render(<App />);
    fireEvent.click(screen.getByRole('button'));

    setUser(null);
    rerender(<App />);
    setUser('u2');
    rerender(<App />);
    expect(screen.getByRole('button').textContent).toBe('Ana (conta anterior)');
  });

  it('o utilizador a mudar por dentro (sem novo render do pai) remonta a árvore', () => {
    setUser('u1');
    const Host = () => {
      const [, force] = useState(0);
      return (
        <>
          <button type="button" onClick={() => force(n => n + 1)}>
            atualizar
          </button>
          <App />
        </>
      );
    };
    render(<Host />);
    fireEvent.click(screen.getByText('Ana (conta anterior)'));
    expect(screen.getByText('mexido')).toBeInTheDocument();

    setUser('u2');
    act(() => {
      fireEvent.click(screen.getByText('atualizar'));
    });
    expect(screen.getByText('Ana (conta anterior)')).toBeInTheDocument();
  });
});
