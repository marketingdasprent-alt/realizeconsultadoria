import { describe, expect, it } from 'vitest';
import { REMOTE_SUPPORT_ORGS, remoteSupportFor } from '../remoteSupport';

describe('instalador do apoio remoto', () => {
  it('a empresa da pessoa vem primeiro (sem acentos nem espaços a mais)', () => {
    expect(remoteSupportFor(' Razão Dinâmica, Lda').mine).toBe('razao-dinamica');
    expect(remoteSupportFor('Realize Consultadoria, Lda').orgs[0].key).toBe('realize');
    expect(remoteSupportFor('Premium Ride').orgs.map(o => o.key)).toEqual([
      'premium-ride',
      'realize',
      'razao-dinamica',
    ]);
  });

  it('sem correspondência mostra as três, sem nenhuma marcada', () => {
    const result = remoteSupportFor('Urbango');
    expect(result.mine).toBeNull();
    expect(result.orgs).toHaveLength(3);
  });

  it('as ligações vão para o servidor de suporte com o grupo certo', () => {
    for (const org of REMOTE_SUPPORT_ORGS) {
      const url = new URL(org.url);
      expect(url.host).toBe('suporte.realizeconsultadoria.pt');
      expect(url.searchParams.get('id')).toBe('4');
      expect(url.searchParams.get('meshid')?.length).toBe(64);
    }
    expect(new URL(REMOTE_SUPPORT_ORGS[0].url).searchParams.get('meshid')).toBe(
      'jraMPY$Faji1CDAzgfmzIrCNAY0zlEGn1gGolTgeiqedrcnOCKTgEiizI$vfKRXu'
    );
  });
});
