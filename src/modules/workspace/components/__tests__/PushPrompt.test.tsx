import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceContext, type WorkspaceContextValue } from '../../context/workspaceContext';
import { PushPrompt } from '../PushPrompt';

const { pushState } = vi.hoisted(() => ({ pushState: vi.fn() }));
vi.mock('../../services/pushService', () => ({
  pushState,
  enablePush: vi.fn(),
  resyncPush: vi.fn(() => Promise.resolve()),
}));

const value = { user: { userId: 'u1' }, isPreview: false } as unknown as WorkspaceContextValue;
const setup = (props: React.ComponentProps<typeof PushPrompt> = {}) =>
  render(
    <MemoryRouter>
      <WorkspaceContext.Provider value={value}>
        <PushPrompt {...props} />
      </WorkspaceContext.Provider>
    </MemoryRouter>
  );

describe('PushPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    pushState.mockReset();
  });

  it('com os avisos desligados convida a ativar', async () => {
    pushState.mockResolvedValue('off');
    setup();
    expect(await screen.findByRole('button', { name: /Ativar avisos/ })).toBeInTheDocument();
    expect(screen.getByText(/email novo/)).toBeInTheDocument();
  });

  it('não aparece com os avisos já ativos', async () => {
    pushState.mockResolvedValue('on');
    setup();
    await waitFor(() => expect(pushState).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('no iPhone mostra "Como instalar" só quando há página para isso', async () => {
    pushState.mockResolvedValue('ios-install');
    const { unmount } = setup();
    expect(await screen.findByRole('link', { name: 'Como instalar' })).toBeInTheDocument();
    unmount();
    setup({ installHref: null });
    expect(await screen.findByText(/Adicionar ao ecrã principal/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Como instalar' })).not.toBeInTheDocument();
  });
});
