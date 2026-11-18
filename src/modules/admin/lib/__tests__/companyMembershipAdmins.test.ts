import { describe, expect, it } from 'vitest';
import { adminCount, canRemoveViewer, countsAsAdmin, isLastAdmin } from '../companyMembership';
import type { CompanyViewer } from '../sharing';

const viewer = (
  user_id: string,
  kind: CompanyViewer['kind'],
  is_company_admin?: boolean
): CompanyViewer => ({
  user_id,
  name: `Nome ${user_id}`,
  email: `${user_id}@exemplo.invalid`,
  kind,
  role: kind,
  ...(is_company_admin === undefined ? {} : { is_company_admin }),
});

describe('último administrador (contado pela pertença)', () => {
  it('um super admin com pertença de administrador conta como administrador', () => {
    const superWithMembership = viewer('s1', 'super_admin', true);
    expect(countsAsAdmin(superWithMembership)).toBe(true);
    expect(adminCount([superWithMembership])).toBe(1);
  });

  it('um super admin sem pertença não conta', () => {
    expect(countsAsAdmin(viewer('s2', 'super_admin', false))).toBe(false);
  });

  it('super admin com pertença e outro administrador: nenhum é o último', () => {
    const viewers = [viewer('s1', 'super_admin', true), viewer('u1', 'admin_empresa', true)];
    expect(adminCount(viewers)).toBe(2);
    expect(isLastAdmin(viewers, viewers[1])).toBe(false);
    expect(isLastAdmin(viewers, viewers[0])).toBe(false);
  });

  it('o único administrador é o super admin com pertença: é o último, e não se retira aqui', () => {
    const viewers = [viewer('s1', 'super_admin', true), viewer('g1', 'gestor', false)];
    expect(isLastAdmin(viewers, viewers[0])).toBe(true);
    expect(canRemoveViewer(viewers[0])).toBe(false);
  });

  it('o administrador de empresa deixa de parecer o último só porque o outro é super admin', () => {
    // Antes contava só admin_empresa: u1 aparecia como último e o botão ficava bloqueado sem razão.
    const viewers = [viewer('s1', 'super_admin', true), viewer('u1', 'admin_empresa', true)];
    expect(isLastAdmin(viewers, viewers[1])).toBe(false);
  });

  it('sem o campo (resposta antiga) conta pelo tipo', () => {
    const viewers = [viewer('u1', 'admin_empresa'), viewer('g1', 'gestor')];
    expect(adminCount(viewers)).toBe(1);
    expect(isLastAdmin(viewers, viewers[0])).toBe(true);
    expect(isLastAdmin(viewers, viewers[1])).toBe(false);
  });

  it('um gestor nunca é o último administrador', () => {
    const viewers = [viewer('u1', 'admin_empresa', true), viewer('g1', 'gestor', false)];
    expect(isLastAdmin(viewers, viewers[1])).toBe(false);
  });
});
