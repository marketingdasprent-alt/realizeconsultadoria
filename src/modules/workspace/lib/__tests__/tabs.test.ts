import { describe, expect, it } from 'vitest';
import { closeTab, parseTabs, tabForPath, visitTab } from '../tabs';

const BASE = '/colaborador';

describe('abas da área do colaborador', () => {
  it('reconhece o módulo pela página', () => {
    expect(tabForPath('/colaborador', BASE)?.key).toBe('messenger');
    expect(tabForPath('/colaborador/email', BASE)?.key).toBe('email');
    expect(tabForPath('/colaborador/definicoes/documentos', BASE)?.key).toBe('settings');
    expect(tabForPath('/colaborador/perfil', BASE)?.key).toBe('profile');
    expect(tabForPath('/admin', BASE)).toBeNull();
  });

  it('abrir um módulo novo acrescenta a aba; voltar a um atualiza a página', () => {
    let tabs = visitTab([], 'feed', '/colaborador/feed');
    tabs = visitTab(tabs, 'email', '/colaborador/email');
    tabs = visitTab(tabs, 'feed', '/colaborador/feed?filtro=comunicados');
    expect(tabs).toEqual([
      { key: 'feed', url: '/colaborador/feed?filtro=comunicados' },
      { key: 'email', url: '/colaborador/email' },
    ]);
  });

  it('fechar a aba ativa vai para a da direita, ou a da esquerda se for a última', () => {
    const tabs = [
      { key: 'feed', url: '/f' },
      { key: 'email', url: '/e' },
      { key: 'tasks', url: '/t' },
    ];
    expect(closeTab(tabs, 'email', 'email').goTo).toBe('/t');
    expect(closeTab(tabs, 'tasks', 'tasks').goTo).toBe('/e');
    expect(closeTab(tabs, 'feed', 'email')).toEqual({ tabs: tabs.slice(1), goTo: null });
    expect(closeTab([{ key: 'feed', url: '/f' }], 'feed', 'feed').goTo).toBeNull();
  });

  it('ignora abas guardadas inválidas', () => {
    expect(parseTabs('[{"key":"feed","url":"/f"},{"key":"x","url":"/x"},3]')).toEqual([
      { key: 'feed', url: '/f' },
    ]);
    expect(parseTabs('lixo')).toEqual([]);
  });
});
