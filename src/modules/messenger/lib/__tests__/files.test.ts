import { describe, expect, it } from 'vitest';
import { normalizeMime, validateFile } from '../files';

describe('tipos dos anexos', () => {
  it('aceita o ZIP do Windows e outros nomes alternativos', () => {
    expect(normalizeMime('application/x-zip-compressed', 'pasta.zip')).toBe('application/zip');
    expect(normalizeMime('image/jpg')).toBe('image/jpeg');
    expect(normalizeMime('audio/webm;codecs=opus')).toBe('audio/webm');
  });

  it('deduz o tipo pela extensão quando o ficheiro chega sem tipo', () => {
    expect(normalizeMime('', 'Relatório.XLSX')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(normalizeMime('application/octet-stream', 'contrato.pdf')).toBe('application/pdf');
    expect(normalizeMime('', 'sem-extensao')).toBe('application/octet-stream');
  });

  it('valida tamanho e tipo', () => {
    expect(validateFile(1024, normalizeMime('application/x-zip-compressed'))).toBeNull();
    expect(validateFile(30 * 1024 * 1024, 'application/pdf')).toMatch(/25 MB/);
    expect(validateFile(10, 'video/mp4')).toBeNull();
    expect(validateFile(10, normalizeMime('', 'PRODUTO.md'), 'PRODUTO.md')).toBeNull();
    expect(validateFile(10, normalizeMime('', 'dados.json'), 'dados.json')).toBeNull();
    expect(validateFile(10, 'application/octet-stream', '.env.local')).toMatch(/\.env/);
    expect(validateFile(10, 'application/x-msdownload', 'setup.exe')).toMatch(/programas/);
    expect(validateFile(10, 'application/octet-stream', 'coisa.xyz')).toMatch(/não é suportado/);
  });
});
