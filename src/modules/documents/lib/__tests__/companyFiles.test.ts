import { describe, expect, it } from 'vitest';
import {
  breadcrumbsFor,
  fileKind,
  filterEntries,
  opensInEditor,
  previewKind,
  sortEntries,
} from '../companyFiles';

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

describe('visualização sem descarregar', () => {
  it('imagens, vídeos e áudio abrem no Realize; o resto descarrega', () => {
    const file = (name: string) => ({ name, type: 'file' as const });
    expect(previewKind(file('Beatriz Dasp Rent.gif'))).toBe('image');
    expect(previewKind(file('foto.JPG'))).toBe('image');
    expect(previewKind(file('logo.svg'))).toBe('image');
    expect(previewKind(file('video.mp4'))).toBe('video');
    expect(previewKind(file('nota.mp3'))).toBe('audio');
    expect(previewKind(file('contrato.docx'))).toBeNull();
    expect(previewKind(file('arquivo.zip'))).toBeNull();
    expect(previewKind(file('foto.heic'))).toBeNull();
    expect(previewKind({ name: 'Imagens', type: 'dir' })).toBeNull();
  });
});

describe('filterEntries', () => {
  const entries = [
    { name: 'Faturação', type: 'dir' as const },
    { name: 'DASP AUTO (VENDAS)', type: 'dir' as const },
    { name: 'Relatório Faturação 2026.xlsx', type: 'file' as const },
  ];

  it('ignores accents and case, and needs every word', () => {
    expect(filterEntries(entries, 'faturacao').map(e => e.name)).toEqual([
      'Faturação',
      'Relatório Faturação 2026.xlsx',
    ]);
    expect(filterEntries(entries, 'fatura 2026')).toHaveLength(1);
    expect(filterEntries(entries, 'vendas')[0].name).toBe('DASP AUTO (VENDAS)');
  });

  it('returns everything for an empty search', () => {
    expect(filterEntries(entries, '   ')).toBe(entries);
  });
});
