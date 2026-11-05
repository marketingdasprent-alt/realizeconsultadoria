// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildZip, crc32 } from '../../../supabase/functions/_shared/mail/zip';

const enc = (value: string) => new TextEncoder().encode(value);

/** Lê o diretório central do zip: nomes, tamanhos, CRC e o conteúdo de cada ficheiro. */
const readZip = (zip: Uint8Array) => {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let pos = view.getUint32(end + 16, true);
  const files: { name: string; crc: number; content: Uint8Array }[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(pos, true)).toBe(0x02014b50);
    const crc = view.getUint32(pos + 16, true);
    const size = view.getUint32(pos + 20, true);
    const nameLength = view.getUint16(pos + 28, true);
    const local = view.getUint32(pos + 42, true);
    const name = new TextDecoder().decode(zip.slice(pos + 46, pos + 46 + nameLength));
    const localNameLength = view.getUint16(local + 26, true);
    const start = local + 30 + localNameLength;
    files.push({ name, crc, content: zip.slice(start, start + size) });
    pos += 46 + nameLength;
  }
  return files;
};

describe('crc32', () => {
  it('dá o valor conhecido de "123456789"', () => {
    expect(crc32(enc('123456789')).toString(16)).toBe('cbf43926');
  });
});

describe('buildZip', () => {
  it('guarda os ficheiros com CRC certo e numera os nomes repetidos', () => {
    const zip = buildZip([
      { name: 'Movimento outubro.pdf', content: enc('%PDF-1 um') },
      { name: 'Movimento outubro.pdf', content: enc('%PDF-1 dois') },
      { name: 'Fatura nº 3.pdf', content: enc('três') },
    ]);
    const files = readZip(zip);
    expect(files.map(f => f.name)).toEqual([
      'Movimento outubro.pdf',
      'Movimento outubro (2).pdf',
      'Fatura nº 3.pdf',
    ]);
    expect(new TextDecoder().decode(files[1].content)).toBe('%PDF-1 dois');
    for (const file of files) expect(file.crc).toBe(crc32(file.content));
  });
});
