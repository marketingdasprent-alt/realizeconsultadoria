import { describe, expect, it } from 'vitest';
import { nameMatches, searchFiles } from '../../../supabase/functions/company-files/search';

const tree: Record<string, { name: string; type: 'dir' | 'file'; modified: string }[]> = {
  'DASPRENT/Frota': [
    { name: 'Contratos', type: 'dir', modified: '' },
    { name: 'Tabela de Preços 2026.xlsx', type: 'file', modified: '' },
  ],
  'DASPRENT/Frota/Contratos': [
    { name: 'Contrato Urbango.pdf', type: 'file', modified: '' },
    { name: 'Contrato Premium.pdf', type: 'file', modified: '' },
  ],
  'DASPRENT/Segredo': [{ name: 'Contrato Urbango secreto.pdf', type: 'file', modified: '' }],
};
const deps = {
  list: async (path: string) => tree[path] ?? [],
  search: async () => null,
};

describe('procurar ficheiros no servidor (Realize IA)', () => {
  it('encontra pelas palavras, sem acentos nem maiúsculas', () => {
    expect(nameMatches('Tabela de Preços 2026.xlsx', 'precos 2026')).toBe(true);
    expect(nameMatches('Contrato Urbango.pdf', 'contrato premium')).toBe(false);
  });

  it('só procura dentro das pastas da pessoa', async () => {
    const { results } = await searchFiles(deps, [{ path: 'DASPRENT/Frota' }], 'contrato urbango');
    expect(results.map(r => r.path)).toEqual(['DASPRENT/Frota/Contratos/Contrato Urbango.pdf']);
  });

  it('a pesquisa do agente não pode trazer nada de fora da pasta', async () => {
    const { results } = await searchFiles(
      {
        ...deps,
        search: async () => [
          { path: 'DASPRENT/Frota/x.pdf', name: 'x.pdf', type: 'file' as const, modified: '' },
          { path: 'DASPRENT/Segredo/y.pdf', name: 'y.pdf', type: 'file' as const, modified: '' },
        ],
      },
      [{ path: 'DASPRENT/Frota' }],
      'x'
    );
    expect(results.map(r => r.path)).toEqual(['DASPRENT/Frota/x.pdf']);
  });
});
