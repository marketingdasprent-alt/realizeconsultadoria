import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../BroadcastAi', () => ({ BroadcastAi: () => null }));
vi.mock('../BroadcastSignaturePicker', () => ({ BroadcastSignaturePicker: () => null }));
vi.mock('@/modules/messenger/components/EmojiPicker', () => ({ EmojiPicker: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getSession: vi.fn() } },
}));

import { BroadcastFields } from '../BroadcastFields';

const Harness = ({ initial }: { initial: string }) => {
  const [draft, setDraft] = useState({ subject: 'Aviso', message: initial, senderName: 'Thiago' });
  return (
    <BroadcastFields
      draft={draft}
      errors={{}}
      onChange={patch => setDraft(d => ({ ...d, ...patch }))}
      signatures={[]}
      attachments={[]}
      uploading={false}
      onAddFiles={vi.fn()}
      onRemoveFile={vi.fn()}
      publishInApp
      onPublishInApp={vi.fn()}
      sendEmail
      onSendEmail={vi.fn()}
    />
  );
};

const box = () => document.getElementById('bc-message') as HTMLTextAreaElement;
const select = (part: string) => {
  const start = box().value.indexOf(part);
  box().focus();
  box().setSelectionRange(start, start + part.length);
};
const frame = () => act(async () => new Promise(r => requestAnimationFrame(() => r(null))));

describe('BroadcastFields: barra «Formatação da mensagem»', () => {
  it('botões com nome e atalho, e o texto de ajuda', () => {
    render(<Harness initial="" />);
    const bar = screen.getByRole('toolbar', { name: 'Formatação da mensagem' });
    expect(bar).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Negrito' })).toHaveAttribute(
      'title',
      'Negrito (Ctrl+B)'
    );
    expect(screen.getByRole('button', { name: 'Itálico' })).toHaveAttribute(
      'title',
      'Itálico (Ctrl+I)'
    );
    expect(screen.getByRole('button', { name: 'Lista com pontos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lista numerada' })).toBeInTheDocument();
    expect(screen.getByText(/fica a negrito/)).toBeInTheDocument();
  });

  it('botão Negrito com seleção, outra vez desfaz; a seleção fica no texto', async () => {
    render(<Harness initial="Na segunda-feira muda" />);
    const user = userEvent.setup();
    select('segunda-feira');
    await user.click(screen.getByRole('button', { name: 'Negrito' }));
    await frame();
    expect(box().value).toBe('Na **segunda-feira** muda');
    expect(box().value.slice(box().selectionStart, box().selectionEnd)).toBe('segunda-feira');
    await user.click(screen.getByRole('button', { name: 'Negrito' }));
    await frame();
    expect(box().value).toBe('Na segunda-feira muda');
  });

  it('Ctrl+B e Ctrl+I na caixa; sem seleção põe as marcas no cursor', async () => {
    render(<Harness initial="Olá mundo" />);
    const user = userEvent.setup();
    select('mundo');
    await user.keyboard('{Control>}i{/Control}');
    await frame();
    expect(box().value).toBe('Olá _mundo_');
    box().setSelectionRange(0, 0);
    await user.keyboard('{Control>}b{/Control}');
    await frame();
    expect(box().value).toBe('****Olá _mundo_');
    expect(box().selectionStart).toBe(2);
  });

  it('listas nas linhas selecionadas, e outra vez tira', async () => {
    render(<Harness initial={'Passos:\num\ndois'} />);
    const user = userEvent.setup();
    select('um\ndois');
    await user.click(screen.getByRole('button', { name: 'Lista numerada' }));
    await frame();
    expect(box().value).toBe('Passos:\n1. um\n2. dois');
    await user.click(screen.getByRole('button', { name: 'Lista numerada' }));
    await frame();
    expect(box().value).toBe('Passos:\num\ndois');
  });

  it('teclado: Tab chega aos botões e Enter aplica', async () => {
    render(<Harness initial="texto" />);
    const user = userEvent.setup();
    const bullets = screen.getByRole('button', { name: 'Lista com pontos' });
    let guard = 0;
    while (document.activeElement !== bullets && guard++ < 30) await user.tab();
    expect(bullets).toHaveFocus();
    await user.keyboard('{Enter}');
    await frame();
    expect(box().value).toBe('- texto');
  });
});
