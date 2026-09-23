import { describe, expect, it } from 'vitest';
import { buildHomeAlerts, getSafetyCheckupStatus, type HomeData } from '../employee-home';

const routes = {
  requests: '/colaborador/pedidos',
  timeclock: '/colaborador/ponto',
  documents: '/colaborador/documentos',
  notices: '/colaborador/avisos',
  more: '/colaborador/mais',
};

const emptyData: HomeData = {
  pendingRequests: 0,
  nextAbsence: null,
  balance: null,
  notices: [],
  unreadNotices: 0,
  nextHoliday: null,
  newDocuments: 0,
  rejectedDocuments: 0,
  pendingDocuments: 0,
  openTickets: 0,
};

const today = new Date('2026-09-24T09:00:00');

describe('getSafetyCheckupStatus', () => {
  it('computes the next exam from the last one and the renewal period', () => {
    expect(getSafetyCheckupStatus(null, 12, today)).toBeNull();
    expect(getSafetyCheckupStatus('2025-10-15', 12, today)).toMatchObject({
      state: 'soon',
      daysLeft: 21,
    });
    expect(getSafetyCheckupStatus('2025-01-01', 12, today)?.state).toBe('overdue');
    expect(getSafetyCheckupStatus('2026-09-01', 24, today)?.state).toBe('ok');
  });
});

describe('buildHomeAlerts', () => {
  it('returns nothing when everything is quiet', () => {
    expect(
      buildHomeAlerts({ data: emptyData, incompleteDays: 0, safety: null, routes, today })
    ).toEqual([]);
  });

  it('orders warnings before informational alerts and links each to its tab', () => {
    const alerts = buildHomeAlerts({
      data: { ...emptyData, unreadNotices: 2, pendingRequests: 1, rejectedDocuments: 1 },
      incompleteDays: 1,
      safety: getSafetyCheckupStatus('2025-01-01', 12, today),
      routes,
      today,
    });
    expect(alerts.map(a => a.id)).toEqual([
      'safety-overdue',
      'timeclock-incomplete',
      'documents-rejected',
      'notices-unread',
      'requests-pending',
    ]);
    expect(alerts[1]).toMatchObject({ tone: 'warning', to: routes.timeclock });
    expect(alerts[3].text).toBe('2 avisos novos.');
  });

  it('announces an approved absence only when it is within two days', () => {
    const soon = buildHomeAlerts({
      data: {
        ...emptyData,
        nextAbsence: { start_date: '2026-09-25', end_date: '2026-09-25', absence_type: 'vacation' },
      },
      incompleteDays: 0,
      safety: null,
      routes,
      today,
    });
    expect(soon[0].text).toBe('Tem uma ausência aprovada amanhã.');

    const far = buildHomeAlerts({
      data: {
        ...emptyData,
        nextAbsence: { start_date: '2026-10-20', end_date: '2026-10-24', absence_type: 'vacation' },
      },
      incompleteDays: 0,
      safety: null,
      routes,
      today,
    });
    expect(far).toEqual([]);
  });
});
