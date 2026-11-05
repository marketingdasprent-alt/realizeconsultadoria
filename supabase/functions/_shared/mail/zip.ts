// ZIP sem compressão ("store"): junta muitos anexos num só ficheiro. Vários servidores de email
// recusam mensagens com mais de 100 partes MIME ("550 Too many MIME parts"); os PDFs e imagens
// já vêm comprimidos, por isso guardar sem comprimir é rápido e quase não aumenta o tamanho.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

export interface ZipEntry {
  name: string;
  content: Uint8Array;
}

/** Nomes repetidos ganham " (2)", " (3)"… (num ZIP dois ficheiros iguais sobrepunham-se). */
const uniqueNames = (entries: ZipEntry[]): string[] => {
  const seen = new Map<string, number>();
  return entries.map(entry => {
    const clean = entry.name.replace(/[\\/]/g, '_').trim() || 'anexo';
    const count = (seen.get(clean.toLowerCase()) ?? 0) + 1;
    seen.set(clean.toLowerCase(), count);
    if (count === 1) return clean;
    const dot = clean.lastIndexOf('.');
    return dot > 0 ? `${clean.slice(0, dot)} (${count})${clean.slice(dot)}` : `${clean} (${count})`;
  });
};

/** Ficheiro .zip (sem compressão, nomes em UTF-8) com estes ficheiros. */
export const buildZip = (entries: ZipEntry[], date = new Date()): Uint8Array => {
  const encoder = new TextEncoder();
  const names = uniqueNames(entries).map(name => encoder.encode(name));
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  entries.forEach((entry, i) => {
    const name = names[i];
    const crc = crc32(entry.content);
    const size = entry.content.length;
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // nomes em UTF-8
    lv.setUint16(8, 0, true); // sem compressão
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local, entry.content);
    centrals.push(central);
    offset += local.length + size;
  });

  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + end.length);
  let pos = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
};
