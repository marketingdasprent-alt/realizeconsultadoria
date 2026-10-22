import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBestPosition } from '@/lib/geolocation';
import type { TimeClockEntryWithRelations } from '@/lib/timeclock';
import { WorkdayProvider } from '../../../context/WorkdayProvider';
import { timeClockService, type PunchResponse } from '../../../services/timeClockService';
import { WorkdayClockButton } from '../WorkdayClockButton';
import { WorkdayPanel } from '../WorkdayPanel';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/geolocation', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/geolocation')>()),
  getBestPosition: vi.fn(),
  getDeviceId: () => 'device-1',
  getGeoPermission: vi.fn().mockResolvedValue('granted'),
}));
vi.mock('../../../services/timeClockService', () => ({
  timeClockService: {
    getCurrentEmployee: vi.fn(),
    getMyEntries: vi.fn(),
    punch: vi.fn(),
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
    latitude: 39.749,
    address: null,
    location: { name: 'Rua Das Oliveiras' },
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
    address: e.address,
    location_name: 'Rua Das Oliveiras',
    work_mode: e.work_mode,
    created_at: e.created_at,
  },
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

  afterEach(() => {
    vi.useRealTimers();
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

    expect(await screen.findByText('A trabalhar')).toBeInTheDocument();
    expect(timeClockService.punch).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'start',
        method: 'gps',
        device_id: 'device-1',
        position: expect.objectContaining({ lat: 39.749, accuracy: 12 }),
      })
    );
    expect(screen.getByRole('button', { name: 'Pausa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminar dia' })).toBeInTheDocument();
    expect(screen.getByText('Rua Das Oliveiras')).toBeInTheDocument();
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

  it('registers without GPS quietly: no approval message, the timeline says why', async () => {
    vi.mocked(getBestPosition).mockRejectedValue(new Error('Permissão de localização negada.'));
    const pending = entry('in', 'work', new Date().toISOString(), {
      status: 'pending',
      work_mode: 'remote',
      flags: ['no_gps', 'remote'],
      latitude: null,
      location: null,
    });
    vi.mocked(timeClockService.punch).mockResolvedValue({
      data: punchResponse(pending, 'pending_approval'),
      error: null,
    });
    renderPanel();

    const startButton = await screen.findByRole('button', { name: 'Iniciar dia' });
    vi.mocked(timeClockService.getMyEntries).mockResolvedValue({ data: [pending], error: null });
    fireEvent.click(startButton);

    expect(await screen.findByText('Sem localização')).toBeInTheDocument();
    expect(timeClockService.punch).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'start', position: null })
    );
    expect(screen.queryByText(/aprova/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Desfazer/)).not.toBeInTheDocument();
  });

  it('shows where the person was instead of "a aprovar"', async () => {
    vi.mocked(timeClockService.getMyEntries).mockResolvedValue({
      data: [
        entry('in', 'work', minutesAgo(60), {
          status: 'pending',
          flags: ['outside_location', 'remote'],
          location: null,
          address: 'Rua da Ferraria 3, Leiria',
        }),
      ],
      error: null,
    });
    renderPanel();

    expect(await screen.findByText('Rua da Ferraria 3, Leiria')).toBeInTheDocument();
    expect(screen.getByText('Moradas © OpenStreetMap')).toBeInTheDocument();
    expect(screen.queryByText(/a aprovar/)).not.toBeInTheDocument();
  });

  it('continues a day ended by mistake and registers the forgotten return (✎)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-14T17:38:00'));
    // Almoço gravado como fim do dia; esqueceu-se de registar o regresso às 14:00.
    const lunch = entry('out', 'work', new Date('2026-10-14T13:01:00').toISOString());
    vi.mocked(timeClockService.getMyEntries).mockResolvedValue({
      data: [entry('in', 'work', new Date('2026-10-14T08:44:00').toISOString()), lunch],
      error: null,
    });
    const back = entry('in', 'break', new Date('2026-10-14T14:00:00').toISOString(), {
      status: 'pending',
      flags: ['manual_time'],
    });
    vi.mocked(timeClockService.punch).mockResolvedValue({
      data: punchResponse(back, 'pending_approval'),
      error: null,
    });
    renderPanel();

    expect(await screen.findByText('Dia terminado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar dia' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Registar com outra hora' }));
    fireEvent.change(screen.getByLabelText('Hora do registo'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('Motivo da correção'), {
      target: { value: 'Esqueci-me de registar o regresso do almoço' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Retomar dia' }));

    await waitFor(() =>
      expect(timeClockService.punch).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'resume',
          at: new Date('2026-10-14T14:00:00').toISOString(),
          note: 'Esqueci-me de registar o regresso do almoço',
        })
      )
    );
    await waitFor(() =>
      expect(screen.queryByLabelText('Motivo da correção')).not.toBeInTheDocument()
    );
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
    expect(screen.getByRole('button', { name: 'Ver o meu ponto' })).toBeInTheDocument();
  });
});
