import { describe, expect, it } from 'vitest';
import { visibleAdminGroups } from '../adminNavigation';

const allItems = () => visibleAdminGroups(() => true).flatMap(group => group.items);

describe('menu admin: tudo da Partilha passou para Empresas', () => {
  it('já não tem o item "Partilha entre empresas" nem a rota /admin/partilha', () => {
    const items = allItems();
    expect(items.map(item => item.label)).not.toContain('Partilha entre empresas');
    expect(items.map(item => item.href)).not.toContain('/admin/partilha');
  });

  it('mantém "Empresas" (onde a partilha, os administradores e os grupos se gerem)', () => {
    expect(allItems().map(item => item.href)).toContain('/admin/empresas');
  });
});
