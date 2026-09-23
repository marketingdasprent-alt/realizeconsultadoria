// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  aesCmac,
  bytesToHex,
  hexToBytes,
  verifySunMessage,
} from '../../../supabase/functions/_shared/ntag424';

const ZERO_KEY = new Uint8Array(16);

describe('aesCmac (RFC 4493)', () => {
  const key = hexToBytes('2b7e151628aed2a6abf7158809cf4f3c');

  it('computes CMAC of an empty message', async () => {
    expect(bytesToHex(await aesCmac(key, new Uint8Array(0)))).toBe(
      'BB1D6929E95937287FA37D129B756746'
    );
  });

  it('computes CMAC of a full block', async () => {
    const msg = hexToBytes('6bc1bee22e409f96e93d7e117393172a');
    expect(bytesToHex(await aesCmac(key, msg))).toBe('070A16B46B4D4144F79BDD9DD04A287C');
  });

  it('computes CMAC of a partial last block (40 bytes)', async () => {
    const msg = hexToBytes(
      '6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411'
    );
    expect(bytesToHex(await aesCmac(key, msg))).toBe('DFA66747DE9AE63030CA32611497C827');
  });
});

describe('verifySunMessage (NXP AN12196)', () => {
  it('decrypts UID + counter and validates the MAC of the reference vector', async () => {
    const result = await verifySunMessage(
      'EF963FF7828658A599F3041510671E88',
      '94EED9EE65337086',
      ZERO_KEY,
      ZERO_KEY
    );
    expect(result).toEqual({ valid: true, uid: '04DE5F1EACC040', counter: 61 });
  });

  it('rejects a tampered MAC', async () => {
    const result = await verifySunMessage(
      'EF963FF7828658A599F3041510671E88',
      '94EED9EE65337087',
      ZERO_KEY,
      ZERO_KEY
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad_mac');
  });

  it('rejects a message produced with a different key', async () => {
    const otherKey = hexToBytes('00112233445566778899aabbccddeeff');
    const result = await verifySunMessage(
      'EF963FF7828658A599F3041510671E88',
      '94EED9EE65337086',
      otherKey,
      otherKey
    );
    expect(result.valid).toBe(false);
  });

  it('rejects malformed input', async () => {
    expect((await verifySunMessage('xyz', '00', ZERO_KEY, ZERO_KEY)).reason).toBe('bad_format');
    expect((await verifySunMessage('00', '0000000000000000', ZERO_KEY, ZERO_KEY)).reason).toBe(
      'bad_format'
    );
  });
});
