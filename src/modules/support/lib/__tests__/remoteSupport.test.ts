import { describe, expect, it } from 'vitest';
import { REMOTE_SUPPORT_ORGS } from '../remoteSupport';

describe('instalador do apoio remoto', () => {
  it('as três organizações, pela ordem fixa', () => {
    expect(REMOTE_SUPPORT_ORGS.map(o => o.name)).toEqual([
      'Realize Consultadoria',
      'Premium Ride',
      'Razão Dinâmica',
    ]);
  });

  it('as ligações vão para o servidor de suporte com o grupo certo', () => {
    for (const org of REMOTE_SUPPORT_ORGS) {
      const url = new URL(org.url);
      expect(url.host).toBe('suporte.realizeconsultadoria.pt');
      expect(url.searchParams.get('id')).toBe('4');
      expect(url.searchParams.get('meshid')?.length).toBe(64);
    }
  });
});
