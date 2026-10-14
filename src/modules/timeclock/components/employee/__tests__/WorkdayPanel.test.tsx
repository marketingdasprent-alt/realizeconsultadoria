import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBestPosition } from '@/lib/geolocation';
import type { TimeClockEntryWithRelations } from '@/lib/timeclock';
import { WorkdayProvider } from '../../../context/WorkdayProvider';
import { timeClockService, type PunchResponse } from '../../../services/timeClockService';
import { WorkdayClockButton } from '../WorkdayClockButton';
import { WorkdayPanel } from '../WorkdayPanel';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/geolocation', () => ({ getBestPosition: vi.fn(), getDeviceId: () => 'device-1' }));
vi.mock('../../../services/timeClockService', () => ({
  timeClockService: {
    getCurrentEmployee: vi.fn(),
    getMyEntries: vi.fn(),
    punch: vi.fn(),
    undoOwnEntry: vi.fn(),
  },
}));

// O Popover do Radix mede o tamanho com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

let seq = 0;
const entry = (
  entry_type: 'in' | 'out',
  kind: 'work' | 'break',
  punched_at: string,
  extra: Partial<TimeClockEntryWithRelations> = {}
) =>
  ({
    id: `entry-${++seq}`,
    employee_id: 'emp-1',
    company_id: 'c-1',
    entry_type,
    kind,
    punched_at,
    created_at: punched_at,
    status: 'valid',
    flags: [],
    source: 'gps',
    work_mode: 'office',
    location: { name: 'Escritório Leiria' },
    ...extra,
  }) as TimeClockEntryWithRelations;

const punchResponse = (e: TimeClockEntryWithRelations, code = 'registered'): PunchResponse => ({
  ok: true,
  code,
  state: e.entry_type === 'in' ? 'working' : 'closed',
  entry: {
    id: e.id,
    entry_type: e.entry_type as 'in' | 'out',
    kind: e.kind as 'work' | 'break',
    punched_at: e.punched_at,
    status: e.status,
    flags: e.flags,
    distance_m: 12,
    location_name: 'Escritório Leiria',
    work_mode: e.work_mode,
    created_at: e.created_at,
  },
  distance_m: 12,
  location_name: 'Escritório Leiria',
});

const renderPanel = (ui = <WorkdayPanel />) =>
  render(
    <MemoryRouter>
      <WorkdayProvider>{ui}</WorkdayProvider>
    </MemoryRouter>
  );

describe('WorkdayPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(timeClockService.getCurrentEmployee).mockResolvedValue({
      data: { id: 'emp-1', name: 'Ana Silva', company_id: 'c-1', companies: null },
      error: null,
    });
    vi.mocked(timeClockService.getMyEntries).mockResolvedValue({ data: [], error: null });
    vi.mocked(getBestPosition).mockResolvedValue({
      lat: 39.749,
      lng: -8.807,
      accuracy: 12,
      age_ms: 300,
    });
  });

  it('starts the day with one tap and switches to Pausa / Terminar dia', async () => {
    const started = entry('in', 'work', new Date().toISOString());
    vi.mocked(timeClockService.punch).mockResolvedValue({
      data: punchResponse(started),
      error: null,
    });
    renderPanel();

    expect(await screen.findByText('Dia não iniciado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pausa' })).not.toBeInTheDocument();

    vi.mocked(timeClockService.getMyEntries).mockResolvedValue({ data: [started], error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar dia' }));

    await waitFor(() => expect(screen.getByText(/Dia iniciado às/)).toBeInTheDocument());
    expect(timeClockService.punch).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'start',
        method: 'gps',
        device_id: 'device-1',
        position: expect.objectContaining({ lat: 39.749, accuracy: 12 }),
      })
    );
    expect(await screen.findByText('A trabalhar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pausa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminar dia' })).toBeInTheDocument();
  });

  it('shows Retomar while paused, with the pause timer', async () => {
    vi.mocked(timeClockService.getMyEntries).mockResolvedValue({
      data: [entry('in', 'work', minutesAgo(200)), entry('out', 'break', minutesAgo(15))],
      error: null,
    });
    renderPanel();

    expect(await screen.findByText('Em pausa')).toBeInTheDocument();
    expect(screen.getByTestId('workday-timer').textContent).toMatch(/^00:1[45]:\d\d$/);
    expect(screen.getByRole('button', { name: 'Retomar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminar dia' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar dia' })).not.toBeInTheDocument();
  });

  it('registers even without GPS and explains why it waits for approval', async () => {
    vi.mocked(getBestPosition).mockRejectedValue(new Error('Permissão de localização negada.'));
    const pending = entry('in', 'work', new Date().toISOString(), {
      status: 'pending',
      work_mode: 'remote',
      flags: ['no_gps', 'remote'],
    });
    vi.mocked(timeClockService.punch).mockResolvedValue({
      data: punchResponse(pending, 'pending_approval'),
      error: null,
    });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar dia' }));

    await waitFor(() => expect(screen.getByText(/aguarda aprovação dos RH/)).toBeInTheDocument());
    expect(screen.getByText(/Não foi possível obter a sua localização/)).toBeInTheDocument();
    expect(timeClockService.punch).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'start', position: null })
    );
  });

  it('undoes the last registration', async () => {
    const started = entry('in', 'work', new Date().toISOString());
    vi.mocked(timeClockService.punch).mockResolvedValue({
      data: punchResponse(started),
      error: null,
    });
    vi.mocked(timeClockService.undoOwnEntry).mockResolvedValue({ data: 'closed', error: null });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar dia' }));
    fireEvent.click(await screen.findByRole('button', { name: /Desfazer/ }));

    await waitFor(() => expect(timeClockService.undoOwnEntry).toHaveBeenCalledWith(started.id));
    await waitFor(() => expect(screen.queryByText(/Dia iniciado às/)).not.toBeInTheDocument());
  });
});

describe('WorkdayClockButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(timeClockService.getCurrentEmployee).mockResolvedValue({
      data: { id: 'emp-1', name: 'Ana Silva', company_id: 'c-1', companies: null },
      error: null,
    });
    vi.mocked(timeClockService.getMyEntries).mockResolvedValue({
      data: [entry('in', 'work', minutesAgo(30))],
      error: null,
    });
    vi.mocked(getBestPosition).mockResolvedValue({ lat: 1, lng: 1, accuracy: 10, age_ms: 0 });
  });

  it('renders nothing outside the employee area', () => {
    const { container } = render(
      <MemoryRouter>
        <WorkdayClockButton />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the time and state in the header and opens the panel', async () => {
    renderPanel(<WorkdayClockButton />);

    const trigger = await screen.findByRole('button', { name: 'Ponto: A trabalhar' });
    expect(trigger.textContent).toMatch(/\d{2}:\d{2}/);

    fireEvent.click(trigger);

    expect(await screen.findByRole('button', { name: 'Terminar dia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver o meu ponto/ })).toBeInTheDocument();
  });
});
