import { describe, expect, it } from 'vitest';
import { accessLabel, accessStatus } from '../accessStatus';

const now = new Date('2026-10-23T12:00:00Z').getTime();

describe('accessStatus', () => {
  it('flags who never signed in', () => {
    expect(accessStatus(null, now)).toEqual({ kind: 'never' });
    expect(accessLabel(accessStatus(null, now))).toBe('Nunca entrou na app');
  });

  it('flags who has not signed in for a week or more', () => {
    const status = accessStatus('2026-10-14T12:00:00Z', now);
    expect(status).toEqual({ kind: 'stale', days: 9 });
    expect(accessLabel(status)).toBe('Não entra há 9 dias');
  });

  it('leaves recent users alone', () => {
    const status = accessStatus('2026-10-20T12:00:00Z', now);
    expect(status.kind).toBe('recent');
    expect(accessLabel(status)).toBeNull();
  });
});
