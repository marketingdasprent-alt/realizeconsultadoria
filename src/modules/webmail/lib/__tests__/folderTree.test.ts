import { describe, expect, it } from 'vitest';
import { flattenFolders } from '../folderTree';
import type { MailCustomFolder } from '../../types';

const folder = (id: string, name: string, parentId: string | null = null): MailCustomFolder => ({
  accountId: 'a',
  id,
  name,
  parentId,
  unread: null,
});

describe('flattenFolders', () => {
  it('põe as subpastas logo a seguir à mãe, por ordem alfabética', () => {
    const result = flattenFolders([
      folder('2', 'Tratados', '1'),
      folder('3', 'Por tratar', '1'),
      folder('1', 'Clientes'),
      folder('4', 'Arquivo'),
    ]);
    expect(result.map(r => [r.folder.name, r.depth])).toEqual([
      ['Arquivo', 0],
      ['Clientes', 0],
      ['Por tratar', 1],
      ['Tratados', 1],
    ]);
  });

  it('uma mãe que não está na lista conta como topo e ciclos não prendem', () => {
    const result = flattenFolders([
      folder('1', 'A', '9'),
      folder('2', 'B', '3'),
      folder('3', 'C', '2'),
    ]);
    expect(result.map(r => r.folder.id)).toEqual(['1']);
  });
});
