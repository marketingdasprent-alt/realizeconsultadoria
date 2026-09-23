// Verificação de mensagens SUN (Secure Unique NFC) de tags NXP NTAG 424 DNA.
//
// Cada vez que a tag é lida gera um URL novo com:
//   e = PICCData cifrado (UID + contador de leituras)  → AES-128-CBC, IV zero
//   c = SDMMAC (8 bytes)                                 → AES-CMAC truncado
// Uma cópia/clone da tag não consegue gerar MACs válidos sem a chave AES, e o
// contador crescente impede reutilizar um URL já usado (anti-replay).
//
// Referência: NXP AN12196 "NTAG 424 DNA and NTAG 424 DNA TagTamper features and hints".
//
// Implementado só com WebCrypto (AES-CBC) para correr igual em Deno (edge
// functions) e Node (testes Vitest), sem dependências externas.

const BLOCK = 16;
const ZERO_IV = new Uint8Array(BLOCK);

export interface SunVerification {
  valid: boolean;
  uid?: string; // hex maiúsculo, 7 bytes
  counter?: number;
  reason?: 'bad_format' | 'bad_picc_tag' | 'bad_mac';
}

export const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.trim();
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error('Hex inválido');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
};

export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

/** Cópia para um ArrayBuffer próprio (o WebCrypto rejeita views sobre SharedArrayBuffer). */
const toBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
};

const importKey = (raw: Uint8Array): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', toBuffer(raw), { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);

const xor = (a: Uint8Array, b: Uint8Array): Uint8Array => a.map((v, i) => v ^ b[i]);

/** AES-ECB de um bloco: CBC com IV zero, descartando o bloco de padding PKCS#7. */
const encryptBlock = async (key: CryptoKey, block: Uint8Array): Promise<Uint8Array> => {
  const out = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ZERO_IV }, key, toBuffer(block));
  return new Uint8Array(out).slice(0, BLOCK);
};

/**
 * AES-CBC decrypt (IV zero) de exatamente um bloco. O WebCrypto exige padding
 * PKCS#7 válido, por isso acrescenta-se um segundo bloco que decifra para
 * 0x10 * 16: C2 = E(C1 XOR 0x10..10).
 */
const decryptBlock = async (key: CryptoKey, block: Uint8Array): Promise<Uint8Array> => {
  const pad = new Uint8Array(BLOCK).fill(BLOCK);
  const tail = await encryptBlock(key, xor(block, pad));
  const joined = new Uint8Array(BLOCK * 2);
  joined.set(block);
  joined.set(tail, BLOCK);
  const out = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ZERO_IV }, key, joined);
  return new Uint8Array(out);
};

const shiftLeft = (input: Uint8Array): Uint8Array => {
  const out = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) {
    out[i] = ((input[i] << 1) | (i + 1 < BLOCK ? input[i + 1] >> 7 : 0)) & 0xff;
  }
  if (input[0] & 0x80) out[BLOCK - 1] ^= 0x87;
  return out;
};

/** AES-CMAC (RFC 4493). */
export const aesCmac = async (rawKey: Uint8Array, message: Uint8Array): Promise<Uint8Array> => {
  const key = await importKey(rawKey);
  const l = await encryptBlock(key, new Uint8Array(BLOCK));
  const k1 = shiftLeft(l);
  const k2 = shiftLeft(k1);

  const blocks = Math.max(1, Math.ceil(message.length / BLOCK));
  const complete = message.length > 0 && message.length % BLOCK === 0;
  const data = new Uint8Array(blocks * BLOCK);
  data.set(message);
  if (!complete) data[message.length] = 0x80;

  const lastStart = (blocks - 1) * BLOCK;
  data.set(xor(data.slice(lastStart), complete ? k1 : k2), lastStart);

  const cbc = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ZERO_IV }, key, data);
  return new Uint8Array(cbc).slice(lastStart, lastStart + BLOCK);
};

/** MACt: bytes de índice ímpar do CMAC (S1 || S3 || ... || S15). */
const truncateMac = (mac: Uint8Array): Uint8Array => mac.filter((_, i) => i % 2 === 1);

const timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

/**
 * Verifica um par (e, c) lido de uma NTAG 424 DNA.
 *
 * @param piccDataHex  valor do parâmetro `e` (32 hex)
 * @param macHex       valor do parâmetro `c` (16 hex)
 * @param metaKey      SDMMetaReadKey (16 bytes)
 * @param fileKey      SDMFileReadKey (16 bytes) — pode ser igual à metaKey
 */
export const verifySunMessage = async (
  piccDataHex: string,
  macHex: string,
  metaKey: Uint8Array,
  fileKey: Uint8Array
): Promise<SunVerification> => {
  let enc: Uint8Array;
  let mac: Uint8Array;
  try {
    enc = hexToBytes(piccDataHex);
    mac = hexToBytes(macHex);
  } catch {
    return { valid: false, reason: 'bad_format' };
  }
  if (enc.length !== BLOCK || mac.length !== 8) return { valid: false, reason: 'bad_format' };

  const plain = await decryptBlock(await importKey(metaKey), enc);
  const tag = plain[0];
  const hasUid = (tag & 0x80) !== 0;
  const hasCounter = (tag & 0x40) !== 0;
  const uidLength = tag & 0x0f;
  if (!hasUid || !hasCounter || uidLength !== 7) return { valid: false, reason: 'bad_picc_tag' };

  const uid = plain.slice(1, 8);
  const ctrBytes = plain.slice(8, 11); // LSB primeiro
  const counter = ctrBytes[0] | (ctrBytes[1] << 8) | (ctrBytes[2] << 16);

  // SV2 = 3CC3 0001 0080 || UID || SDMReadCtr  → KSesSDMFileReadMAC
  const sv2 = new Uint8Array(BLOCK);
  sv2.set([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80]);
  sv2.set(uid, 6);
  sv2.set(ctrBytes, 13);
  const sessionKey = await aesCmac(fileKey, sv2);

  // Configuração típica: SDMMACInputOffset == SDMMACOffset → MAC sobre zero bytes.
  // Alguns programadores (ex.: NXP TagWriter) começam o input no valor de `e`,
  // cobrindo "<e>&c=". Aceitam-se ambas.
  const candidates = [new Uint8Array(0), new TextEncoder().encode(`${piccDataHex}&c=`)];
  for (const input of candidates) {
    const expected = truncateMac(await aesCmac(sessionKey, input));
    if (timingSafeEqual(expected, mac)) {
      return { valid: true, uid: bytesToHex(uid), counter };
    }
  }
  return { valid: false, reason: 'bad_mac', uid: bytesToHex(uid), counter };
};
