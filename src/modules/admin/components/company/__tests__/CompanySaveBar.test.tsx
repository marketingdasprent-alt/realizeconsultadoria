import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CompanySaveBar } from '../CompanySaveBar';

type Props = React.ComponentProps<typeof CompanySaveBar>;

const renderBar = (props: Partial<Props> = {}) => {
  const onDiscard = vi.fn();
  const view = render(
    <CompanySaveBar
      formId="company-form"
      isNew={false}
      onDataSection
      dirty={false}
      saving={false}
      onDiscard={onDiscard}
      {...props}
    />
  );
  return { onDiscard, ...view };
};

describe('CompanySaveBar', () => {
  describe('empresa nova', () => {
    it('mostra Cancelar e Criar empresa, mesmo fora da secção dos dados e sem alterações', () => {
      renderBar({ isNew: true, onDataSection: false, dirty: false });
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Criar empresa' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Guardar alterações' })).not.toBeInTheDocument();
    });

    it('não mostra o aviso de alterações, mesmo com alterações', () => {
      renderBar({ isNew: true, dirty: true });
      expect(screen.queryByText('Tem alterações por guardar.')).not.toBeInTheDocument();
    });

    it('Cancelar chama onDiscard', async () => {
      const { onDiscard } = renderBar({ isNew: true });
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(onDiscard).toHaveBeenCalledTimes(1);
    });
  });

  describe('empresa existente', () => {
    it('na secção dos dados aparece mesmo sem alterações, com Descartar desativado', () => {
      renderBar({ onDataSection: true, dirty: false });
      expect(screen.getByRole('group', { name: 'Ações da ficha' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Descartar' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Guardar alterações' })).toBeEnabled();
      expect(screen.queryByText('Tem alterações por guardar.')).not.toBeInTheDocument();
    });

    it('noutra secção e sem alterações não aparece', () => {
      const { container } = renderBar({ onDataSection: false, dirty: false });
      expect(container).toBeEmptyDOMElement();
    });

    it('noutra secção com alterações aparece, com o aviso', () => {
      renderBar({ onDataSection: false, dirty: true });
      expect(screen.getByRole('status')).toHaveTextContent('Tem alterações por guardar.');
      expect(screen.getByRole('button', { name: 'Descartar' })).toBeEnabled();
    });

    it('com alterações na secção dos dados mostra o aviso e ativa Descartar', async () => {
      const { onDiscard } = renderBar({ onDataSection: true, dirty: true });
      expect(screen.getByText('Tem alterações por guardar.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
      expect(onDiscard).toHaveBeenCalledTimes(1);
    });

    it('Descartar desativado não chama onDiscard', async () => {
      const { onDiscard } = renderBar({ dirty: false });
      await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
      expect(onDiscard).not.toHaveBeenCalled();
    });
  });

  it('o botão de submissão pertence ao formulário indicado em formId', () => {
    renderBar({ formId: 'ficha-empresa' });
    const submit = screen.getByRole('button', { name: 'Guardar alterações' });
    expect(submit).toHaveAttribute('type', 'submit');
    expect(submit).toHaveAttribute('form', 'ficha-empresa');
  });

  it('submeter pelo botão envia o formulário com esse id (mesmo estando fora dele)', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <>
        <form id="ficha-empresa" onSubmit={onSubmit} />
        <CompanySaveBar
          formId="ficha-empresa"
          isNew={false}
          onDataSection
          dirty
          saving={false}
          onDiscard={vi.fn()}
        />
      </>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar alterações' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  describe('a guardar', () => {
    it('mostra A guardar… e desativa os dois botões (edição)', () => {
      renderBar({ saving: true, dirty: true });
      expect(screen.getByRole('button', { name: 'A guardar…' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Descartar' })).toBeDisabled();
    });

    it('mostra A guardar… e desativa Cancelar (empresa nova)', () => {
      renderBar({ isNew: true, saving: true });
      expect(screen.getByRole('button', { name: 'A guardar…' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    });
  });
});
