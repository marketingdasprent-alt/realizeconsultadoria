import { describe, expect, it } from 'vitest';
import {
  companyPartilhaPath,
  legacySharingTarget,
  parseCompanyTab,
  parseListTab,
  parseShareSub,
} from '../companyTabs';

describe('separadores da ficha da empresa e da lista', () => {
  it('?tab desconhecido ou em falta abre em Dados', () => {
    expect(parseCompanyTab(null)).toBe('dados');
    expect(parseCompanyTab('xpto')).toBe('dados');
    expect(parseCompanyTab('administradores')).toBe('administradores');
    expect(parseCompanyTab('colaboradores')).toBe('colaboradores');
    expect(parseCompanyTab('partilha')).toBe('partilha');
  });

  it('?sub desconhecido abre em Código', () => {
    expect(parseShareSub(null)).toBe('codigo');
    expect(parseShareSub('xpto')).toBe('codigo');
    for (const sub of ['codigo', 'pedidos', 'acesso', 'grupo', 'quem-ve']) {
      expect(parseShareSub(sub)).toBe(sub);
    }
  });

  it('a lista só tem "Grupos" para o super admin', () => {
    expect(parseListTab('grupos', true)).toBe('grupos');
    expect(parseListTab('grupos', false)).toBe('empresas');
    expect(parseListTab(null, true)).toBe('empresas');
  });

  it('o caminho da Partilha de uma empresa leva o sub-separador', () => {
    expect(companyPartilhaPath('c1')).toBe('/admin/empresas/c1?tab=partilha');
    expect(companyPartilhaPath('c1', 'pedidos')).toBe(
      '/admin/empresas/c1?tab=partilha&sub=pedidos'
    );
    expect(companyPartilhaPath('c1', 'codigo')).toBe('/admin/empresas/c1?tab=partilha');
  });
});

describe('legacySharingTarget: links antigos de /admin/partilha', () => {
  it('?tab=grupos (só super admin) vai para a zona Grupos da lista', () => {
    expect(legacySharingTarget('?tab=grupos', 'c1')).toBe('/admin/empresas?tab=grupos');
  });

  it('cada separador antigo cai no sub-separador igual da empresa', () => {
    expect(legacySharingTarget('?tab=pedidos', 'c1')).toBe(
      '/admin/empresas/c1?tab=partilha&sub=pedidos'
    );
    expect(legacySharingTarget('?tab=acesso', 'c1')).toBe(
      '/admin/empresas/c1?tab=partilha&sub=acesso'
    );
    expect(legacySharingTarget('?tab=grupo', 'c1')).toBe(
      '/admin/empresas/c1?tab=partilha&sub=grupo'
    );
    expect(legacySharingTarget('?tab=quem-ve', 'c1')).toBe(
      '/admin/empresas/c1?tab=partilha&sub=quem-ve'
    );
  });

  it('sem separador (ou código) abre o Código da empresa', () => {
    expect(legacySharingTarget('', 'c1')).toBe('/admin/empresas/c1?tab=partilha');
    expect(legacySharingTarget('?tab=codigo', 'c1')).toBe('/admin/empresas/c1?tab=partilha');
  });

  it('sem empresa para abrir, vai para a lista de empresas (nunca um link partido)', () => {
    expect(legacySharingTarget('?tab=pedidos', null)).toBe('/admin/empresas');
    expect(legacySharingTarget('', null)).toBe('/admin/empresas');
  });
});
