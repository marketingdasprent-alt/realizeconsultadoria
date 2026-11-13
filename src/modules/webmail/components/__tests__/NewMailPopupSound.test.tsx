import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const play = vi.fn().mockResolvedValue(true);
vi.mock('../../lib/mailSound', async () => {
  const real = await vi.importActual<typeof import('../../lib/mailSound')>('../../lib/mailSound');
  return { ...real, playMailSound: (options?: unknown) => play(options) };
});

import { NewMailPopup } from '../NewMailPopup';
import { isMailSoundOn } from '../../lib/mailSound';

let worker: EventTarget;
const send = () =>
  act(() => {
    worker.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'rz-push', kind: 'mail', title: 'Ana', body: 'Proposta', url: '/x' },
      })
    );
  });

describe('NewMailPopup: som', () => {
  beforeEach(() => {
    play.mockClear();
    window.localStorage.clear();
    worker = new EventTarget();
    Object.defineProperty(navigator, 'serviceWorker', { value: worker, configurable: true });
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  const setup = () =>
    render(
      <MemoryRouter>
        <NewMailPopup />
      </MemoryRouter>
    );

  it('toca o som quando o popup aparece', () => {
    setup();
    expect(play).not.toHaveBeenCalled();
    send();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('mensagens que não são de email novo não tocam nada', () => {
    setup();
    act(() => {
      worker.dispatchEvent(new MessageEvent('message', { data: { type: 'rz-open', url: '/x' } }));
    });
    expect(play).not.toHaveBeenCalled();
  });

  it('o botão desliga o som e guarda a escolha; ligar toca para se ouvir', () => {
    setup();
    send();
    fireEvent.click(screen.getByRole('button', { name: 'Desligar o som dos avisos' }));
    expect(isMailSoundOn()).toBe(false);
    expect(screen.getByRole('button', { name: 'Ligar o som dos avisos' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    play.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Ligar o som dos avisos' }));
    expect(isMailSoundOn()).toBe(true);
    expect(play).toHaveBeenCalledWith({ force: true });
  });

  it('com o som desligado antes, o popup mostra o botão como desligado', () => {
    window.localStorage.setItem('rz.mail-sound', '0');
    setup();
    send();
    expect(screen.getByRole('button', { name: 'Ligar o som dos avisos' })).toBeInTheDocument();
  });
});
