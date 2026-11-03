import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transcriptService } from '../../../services/transcriptService';
import type { ChatMessage } from '../../../types';
import { AudioTranscript } from '../AudioTranscript';

vi.mock('../../../services/transcriptService', () => ({
  transcriptService: {
    list: vi.fn(),
    transcribe: vi.fn(),
  },
}));

const message: ChatMessage = {
  id: 'm1',
  conversationId: 'c1',
  senderId: 'u1',
  authorName: 'Ana',
  isMine: false,
  kind: 'audio',
  attachment: { path: 'c1/voz.webm', name: 'voz.webm', size: 1000, mime: 'audio/webm' },
  durationSec: 80,
  createdAt: '2026-11-03T16:56:00Z',
};

const renderIt = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AudioTranscript message={message} />
    </QueryClientProvider>
  );

describe('AudioTranscript', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mostra Transcrever e, depois de transcrever, o texto', async () => {
    vi.mocked(transcriptService.list).mockResolvedValue({ data: [], error: null });
    vi.mocked(transcriptService.transcribe).mockResolvedValue({
      data: { text: 'Bom dia, já vi o documento.' },
      error: null,
    });
    renderIt();
    const button = await screen.findByRole('button', { name: /Transcrever/ });
    // Só se carrega depois de a lista (o que já está transcrito) chegar
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    expect(await screen.findByText('Bom dia, já vi o documento.')).toBeTruthy();
    expect(transcriptService.transcribe).toHaveBeenCalledWith('m1');
  });

  it('se já está transcrita (por outra pessoa) mostra logo o texto, sem botão', async () => {
    vi.mocked(transcriptService.list).mockResolvedValue({
      data: [{ message_id: 'm1', text: 'Já estava transcrita.' }],
      error: null,
    });
    renderIt();
    await waitFor(() => expect(screen.getByText('Já estava transcrita.')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /^Transcrever$/ })).toBeNull();
  });

  it('sem fala reconhecida diz isso', async () => {
    vi.mocked(transcriptService.list).mockResolvedValue({
      data: [{ message_id: 'm1', text: '' }],
      error: null,
    });
    renderIt();
    expect(await screen.findByText('Não se percebeu fala neste áudio.')).toBeTruthy();
  });

  it('não aparece em mensagens sem ficheiro (a enviar)', () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <AudioTranscript message={{ ...message, attachment: undefined }} />
      </QueryClientProvider>
    );
    expect(container.textContent).toBe('');
  });
});
