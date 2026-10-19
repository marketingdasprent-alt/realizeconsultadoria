import { describe, expect, it } from 'vitest';
import {
  accessFor,
  agentUrl,
  buildEditorConfig,
  cleanPath,
  documentKey,
  documentTypeFor,
  editorModeFor,
  freeName,
  isBlockedUpload,
  isValidName,
  parentPath,
  signJwt,
} from '../../../supabase/functions/_shared/company-files';

const BACKSLASH = String.fromCharCode(92);

const decodeSegment = (segment: string) => {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

describe('cleanPath', () => {
  it('aceita caminhos relativos, com acentos e espaços', () => {
    expect(cleanPath('RAZÃO DINÂMICA LDA/Sub pasta/Relatório.docx')).toBe(
      'RAZÃO DINÂMICA LDA/Sub pasta/Relatório.docx'
    );
  });

  it.each([
    '',
    '/DASPRENT',
    'DASPRENT/',
    'DASPRENT//x',
    '..',
    'DASPRENT/../x',
    'DASPRENT/./x',
    `DASPRENT${BACKSLASH}x`,
    'DASPRENT/nome.',
    'DASPRENT/nome ',
    'DASPRENT/a:b',
    `DASPRENT/a${String.fromCharCode(10)}b`,
  ])('recusa %j', raw => {
    expect(cleanPath(raw)).toBeNull();
  });

  it('recusa o que não é texto', () => {
    expect(cleanPath(undefined)).toBeNull();
    expect(cleanPath(['DASPRENT'])).toBeNull();
  });
});

describe('isValidName', () => {
  it('aceita nomes normais e recusa os que o Windows não aceita', () => {
    expect(isValidName('Campanha 2026')).toBe(true);
    expect(isValidName('a*b')).toBe(false);
    expect(isValidName('a/b')).toBe(false);
  });
});

describe('accessFor', () => {
  const folders = [
    { path: 'DASPRENT/Marketing', permission: 'read' as const },
    { path: 'DASPRENT/Marketing/Partilhada', permission: 'edit' as const },
  ];

  it('dá acesso à pasta atribuída e ao que está dentro dela', () => {
    expect(accessFor('DASPRENT/Marketing', folders)).toBe('read');
    expect(accessFor('DASPRENT/Marketing/Plano.docx', folders)).toBe('read');
  });

  it('não confunde pastas com o mesmo início de nome', () => {
    expect(accessFor('DASPRENT/Marketing2/x.docx', folders)).toBeNull();
    expect(accessFor('DASPRENT', folders)).toBeNull();
  });

  it('a edição ganha à leitura', () => {
    expect(accessFor('DASPRENT/Marketing/Partilhada/x.xlsx', folders)).toBe('edit');
  });
});

describe('editor', () => {
  it('escolhe o tipo de editor pela extensão', () => {
    expect(documentTypeFor('docx')).toBe('word');
    expect(documentTypeFor('xls')).toBe('cell');
    expect(documentTypeFor('pptx')).toBe('slide');
    expect(documentTypeFor('pdf')).toBe('pdf');
    expect(documentTypeFor('zip')).toBeNull();
  });

  it('formatos antigos e pastas de leitura abrem só para ver', () => {
    expect(editorModeFor('docx', 'edit')).toBe('edit');
    expect(editorModeFor('pdf', 'edit')).toBe('edit');
    expect(editorModeFor('doc', 'edit')).toBe('view');
    expect(editorModeFor('odt', 'edit')).toBe('view');
    expect(editorModeFor('docx', 'read')).toBe('view');
  });

  it('o document.key muda quando o ficheiro muda', async () => {
    const key = await documentKey('_SAAS_TESTE/a.docx', '2026-10-16T10:00:00Z', 100);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(await documentKey('_SAAS_TESTE/a.docx', '2026-10-16T10:05:00Z', 100)).not.toBe(key);
  });

  it('monta a config com os endereços locais do agente', async () => {
    const config = await buildEditorConfig({
      path: 'RAZÃO DINÂMICA LDA/Relatório final.docx',
      modified: '2026-10-16T10:00:00Z',
      size: 2048,
      mode: 'edit',
      documentType: 'word',
      user: { id: 'u1', name: 'Ana' },
      localAgentUrl: 'http://127.0.0.1:8181',
      downloadToken: 'd.t',
      callbackToken: 'c.t',
    });
    const encoded = 'RAZ%C3%83O%20DIN%C3%82MICA%20LDA%2FRelat%C3%B3rio%20final.docx';
    expect(config.document.url).toBe(`http://127.0.0.1:8181/api/file?path=${encoded}&token=d.t`);
    expect(config.editorConfig.callbackUrl).toBe(
      `http://127.0.0.1:8181/onlyoffice/callback?path=${encoded}&token=c.t`
    );
    expect(config.document.title).toBe('Relatório final.docx');
    expect(config.document.fileType).toBe('docx');
    expect(config.editorConfig.mode).toBe('edit');
    expect(config.editorConfig.lang).toBe('pt-PT');
  });
});

describe('agente', () => {
  it('codifica o caminho no endereço', () => {
    expect(
      agentUrl('https://files.dasprent.pt', '/api/list', '_SAAS_TESTE/Colaborador Teste')
    ).toBe('https://files.dasprent.pt/api/list?path=_SAAS_TESTE%2FColaborador%20Teste');
  });

  it('parentPath', () => {
    expect(parentPath('_SAAS_TESTE/a/b.docx')).toBe('_SAAS_TESTE/a');
    expect(parentPath('_SAAS_TESTE')).toBe('');
  });

  it('assina um JWT HS256 válido, com acentos no caminho', async () => {
    const payload = { op: 'list', path: 'RAZÃO DINÂMICA LDA', exp: 2_000_000_000 };
    const token = await signJwt(payload, 'segredo-de-teste');
    const [header, body, signature] = token.split('.');
    expect(decodeSegment(header)).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(decodeSegment(body)).toEqual(payload);

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode('segredo-de-teste'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), ch =>
      ch.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(`${header}.${body}`)
    );
    expect(valid).toBe(true);
  });
});

describe('carregar ficheiros', () => {
  it('escolhe um nome livre, sem distinguir maiúsculas (como o Windows)', () => {
    expect(freeName('Ata.docx', ['Outro.xlsx'])).toBe('Ata.docx');
    expect(freeName('Ata.docx', ['ata.DOCX'])).toBe('Ata (2).docx');
    expect(freeName('Ata.docx', ['Ata.docx', 'Ata (2).docx'])).toBe('Ata (3).docx');
    expect(freeName('LEIA-ME', ['leia-me'])).toBe('LEIA-ME (2)');
  });

  it('recusa programas e scripts', () => {
    expect(isBlockedUpload('instalar.EXE')).toBe(true);
    expect(isBlockedUpload('script.ps1')).toBe(true);
    expect(isBlockedUpload('Relatório.pdf')).toBe(false);
    expect(isBlockedUpload('fotos.zip')).toBe(false);
  });
});
