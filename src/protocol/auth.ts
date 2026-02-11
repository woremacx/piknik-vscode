import { blake2b } from "@noble/hashes/blake2b";
import { PERSON } from "./constants.js";
import { concat } from "./binary.js";

/** Create a 16-byte salt with stage number in first byte. */
function makeSalt(stage: number): Uint8Array {
  const salt = new Uint8Array(16);
  salt[0] = stage;
  return salt;
}

function blake2bAuth(
  psk: Uint8Array,
  salt: Uint8Array,
  ...inputs: Uint8Array[]
): Uint8Array {
  const data = concat(...inputs);
  return blake2b(data, {
    key: psk,
    personalization: PERSON,
    salt,
    dkLen: 32,
  });
}

/** auth0: hash(version || r) with salt=0 */
export function auth0(
  psk: Uint8Array,
  version: number,
  r: Uint8Array
): Uint8Array {
  return blake2bAuth(psk, makeSalt(0), new Uint8Array([version]), r);
}

/** auth1: hash(version || r2 || h0) with salt=1 */
export function auth1(
  psk: Uint8Array,
  version: number,
  h0: Uint8Array,
  r2: Uint8Array
): Uint8Array {
  return blake2bAuth(
    psk,
    makeSalt(1),
    new Uint8Array([version]),
    r2,
    h0
  );
}

/** auth2get: hash(h1 || opcode) with salt=2 */
export function auth2get(
  psk: Uint8Array,
  h1: Uint8Array,
  opcode: number
): Uint8Array {
  return blake2bAuth(psk, makeSalt(2), h1, new Uint8Array([opcode]));
}

/** auth2store: hash(h1 || opcode || ts || signature) with salt=2 */
export function auth2store(
  psk: Uint8Array,
  h1: Uint8Array,
  opcode: number,
  ts: Uint8Array,
  signature: Uint8Array
): Uint8Array {
  return blake2bAuth(
    psk,
    makeSalt(2),
    h1,
    new Uint8Array([opcode]),
    ts,
    signature
  );
}

/** auth3get: hash(h2 || ts || signature) with salt=3 */
export function auth3get(
  psk: Uint8Array,
  h2: Uint8Array,
  ts: Uint8Array,
  signature: Uint8Array
): Uint8Array {
  return blake2bAuth(psk, makeSalt(3), h2, ts, signature);
}

/** auth3store: hash(h2) with salt=3 */
export function auth3store(psk: Uint8Array, h2: Uint8Array): Uint8Array {
  return blake2bAuth(psk, makeSalt(3), h2);
}
