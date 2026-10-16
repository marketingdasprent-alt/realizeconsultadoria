import { describe, expect, it } from 'vitest';
import { breadcrumbsFor, fileKind, opensInEditor, sortEntries } from '../companyFiles';

const folders = [
  { path: 'DASPRENT/Marketing', name: 'Marketing' },
  { path: '_SAAS_TESTE', name: 'Pasta de testes' },
];

describe('breadcrumbsFor', () => {
  it('começa sempre em Documentos', () => {
    expect(breadcrumbsFor(null, folders)).toEqual([{ label: 'Documentos', path: null }]);
  });

  it('esconde o que está acima da pasta atribuída e usa o nome dela', () => {
    expect(breadcrumbsFor('DASPRENT/Marketing/2026/Campanhas', folders)).toEqual([
      { label: 'Documentos', path: null },
      { label: 'Marketing', path: 'DASPRENT/Marketing' },
      { label: '2026', path: 'DASPRENT/Marketing/2026' },
      { label: 'Campanhas', path: 'DASPRENT/Marketing/2026/Campanhas' },
    ]);
    expect(breadcrumbsFor('_SAAS_TESTE', folders).map(crumb => crumb.label)).toEqual([
      'Documentos',
      'Pasta de testes',
    ]);
  });
});

describe('sortEntries', () => {
  it('pastas primeiro e números por ordem natural', () => {
    const sorted = sortEntries([
      { name: 'b.docx', type: 'file' as const },
      { name: 'Pasta 10', type: 'dir' as const },
      { name: 'a.docx', type: 'file' as const },
      { name: 'Pasta 2', type: 'dir' as const },
    ]);
    expect(sorted.map(entry => entry.name)).toEqual(['Pasta 2', 'Pasta 10', 'a.docx', 'b.docx']);
  });
});

describe('tipos de ficheiro', () => {
  it('reconhece documentos, imagens e o resto', () => {
    expect(fileKind({ name: 'Plano.DOCX', type: 'file' })).toBe('word');
    expect(fileKind({ name: 'Foto.jpg', type: 'file' })).toBe('image');
    expect(fileKind({ name: 'Arquivo.zip', type: 'file' })).toBe('other');
    expect(fileKind({ name: 'Faturas.xlsx', type: 'dir' })).toBe('folder');
  });

  it('só os documentos abrem no editor', () => {
    expect(opensInEditor({ name: 'Folha.xlsx', type: 'file' })).toBe(true);
    expect(opensInEditor({ name: 'Contrato.pdf', type: 'file' })).toBe(true);
    expect(opensInEditor({ name: 'Foto.png', type: 'file' })).toBe(false);
  });
});
