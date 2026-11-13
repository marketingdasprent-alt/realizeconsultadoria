import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { NewMailPopup } from '../NewMailPopup';

const Where: React.FC = () => <span data-testid="where">{useLocation().pathname}</span>;
const origin = window.location.origin;

let worker: EventTarget;
const send = (data: unknown) =>
  act(() => {
    worker.dispatchEvent(new MessageEvent('message', { data }));
  });
const newMail = (over: Record<string, unknown> = {}) => ({
  type: 'rz-push',
  kind: 'mail',
  title: 'Ana Silva',
  body: 'Proposta de renovação',
  url: `${origin}/colaborador/email`,
  ...over,
});

const setup = () =>
  render(
    <MemoryRouter initialEntries={['/inicio']}>
      <NewMailPopup />
      <Where />
    </MemoryRouter>
  );

describe('NewMailPopup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    worker = new EventTarget();
    Object.defineProperty(navigator, 'serviceWorker', { value: worker, configurable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('não mostra nada até chegar um email', () => {
    setup();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mostra o remetente e o assunto num popup grande', () => {
    setup();
    send(newMail());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText('Proposta de renovação')).toBeInTheDocument();
    expect(screen.getByText('Email novo')).toBeInTheDocument();
  });

  it('um segundo email substitui o primeiro e conta quantos chegaram', () => {
    setup();
    send(newMail());
    send(newMail({ title: 'Rui', body: 'Fatura' }));
    expect(screen.getByText('2 emails novos')).toBeInTheDocument();
    expect(screen.getByText('Rui')).toBeInTheDocument();
    expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument();
  });

  it('"Abrir o email" vai para o email e fecha o popup', () => {
    setup();
    send(newMail());
    fireEvent.click(screen.getByRole('button', { name: /Abrir o email/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/colaborador/email');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('"Depois" e o X fecham sem navegar', () => {
    setup();
    send(newMail());
    fireEvent.click(screen.getByRole('button', { name: 'Depois' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/inicio');
    send(newMail());
    fireEvent.click(screen.getByRole('button', { name: 'Fechar o aviso' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('fecha sozinho passados 20 segundos', () => {
    setup();
    send(newMail());
    act(() => {
      vi.advanceTimersByTime(20_001);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('nunca navega para outro site', () => {
    setup();
    send(newMail({ url: 'https://evil.example/x' }));
    fireEvent.click(screen.getByRole('button', { name: /Abrir o email/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/inicio');
  });

  it('tocar no aviso do sistema leva a app para o email, sem popup', () => {
    setup();
    send({ type: 'rz-open', url: `${origin}/colaborador/email` });
    expect(screen.getByTestId('where')).toHaveTextContent('/colaborador/email');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignora mensagens que não são de email novo', () => {
    setup();
    send({ type: 'rz-push', kind: 'chat', title: 'x' });
    send('lixo');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
