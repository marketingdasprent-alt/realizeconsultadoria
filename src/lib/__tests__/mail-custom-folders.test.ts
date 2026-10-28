import { describe, expect, it } from 'vitest';
import {
  buildGraphListUrl,
  customImapFolders,
  graphCustomFolders,
} from '../../../supabase/functions/_shared/mail/folders';

describe('graphCustomFolders', () => {
  const system = new Map([
    ['INBOX', 'inbox'],
    ['DEL', 'deleteditems'],
    ['SYNC', 'syncissues'],
    ['ARCH', 'archive'],
  ]);
  const all = [
    { id: 'INBOX', displayName: 'Caixa de Entrada', parentFolderId: 'ROOT' },
    { id: 'DEL', displayName: 'Itens Eliminados', parentFolderId: 'ROOT' },
    { id: 'SYNC', displayName: 'Problemas', parentFolderId: 'ROOT' },
    { id: 'ARCH', displayName: 'Arquivo', parentFolderId: 'ROOT' },
    { id: 'CLI', displayName: 'Clientes', parentFolderId: 'ROOT', unreadItemCount: 3 },
    { id: 'NORTE', displayName: 'Norte', parentFolderId: 'CLI', unreadItemCount: 0 },
    { id: 'FAT', displayName: 'Faturas', parentFolderId: 'INBOX' },
    { id: 'OLD', displayName: 'Antiga', parentFolderId: 'DEL' },
    { id: 'CONF', displayName: 'Conflitos', parentFolderId: 'SYNC' },
    { id: '2025', displayName: '2025', parentFolderId: 'ARCH' },
  ];

  it('mostra só as pastas da pessoa, com a árvore', () => {
    expect(graphCustomFolders(all, system)).toEqual([
      { id: 'CLI', name: 'Clientes', parent_id: null, unread: 3 },
      { id: 'NORTE', name: 'Norte', parent_id: 'CLI', unread: 0 },
      { id: 'FAT', name: 'Faturas', parent_id: null, unread: null },
      { id: '2025', name: '2025', parent_id: null, unread: null },
    ]);
  });
});

describe('customImapFolders', () => {
  const flags = (...f: string[]) => new Set(f);
  it('tira a INBOX, as de sistema e as que não existem', () => {
    const result = customImapFolders([
      { path: 'INBOX', name: 'INBOX', delimiter: '.' },
      { path: 'INBOX.Sent', name: 'Sent', delimiter: '.', specialUse: '\\Sent' },
      { path: 'INBOX.Trash', name: 'Trash', delimiter: '.' },
      { path: 'INBOX.Clientes', name: 'Clientes', delimiter: '.', parentPath: 'INBOX' },
      {
        path: 'INBOX.Clientes.Norte',
        name: 'Norte',
        delimiter: '.',
        parentPath: 'INBOX.Clientes',
      },
      { path: 'Vazia', name: 'Vazia', delimiter: '.', flags: flags('\\Noselect') },
      { path: 'Fantasma', name: 'Fantasma', delimiter: '.', flags: flags('\\NonExistent') },
    ]);
    expect(result).toEqual([
      { id: 'INBOX.Clientes', name: 'Clientes', parent_id: null, unread: null },
      { id: 'INBOX.Clientes.Norte', name: 'Norte', parent_id: 'INBOX.Clientes', unread: null },
    ]);
  });
});

describe('buildGraphListUrl com pasta da pessoa', () => {
  it('lista essa pasta, sem filtros de marcadas', () => {
    const { url, postFilterFlagged } = buildGraphListUrl('starred', {
      query: null,
      limit: 25,
      root: 'https://graph.microsoft.com/v1.0/me',
      folderId: 'AAM/x=',
    });
    expect(url).toContain('/me/mailFolders/AAM%2Fx%3D/messages?');
    expect(url).not.toContain('flagStatus');
    expect(postFilterFlagged).toBe(false);
  });
});
