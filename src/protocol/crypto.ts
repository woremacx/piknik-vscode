import { xchacha20 } from "@noble/ciphers/chacha";
import { ed25519 } from "@noble/curves/ed25519";
import { blake2b } from "@noble/hashes/blake2b";
import { randomBytes } from "@noble/ciphers/webcrypto";
import { PERSON } from "./constants.js";
import { concat } from "./binary.js";

/** Encrypt plaintext with XChaCha20 (unauthenticated stream cipher). */
export function xchacha20Encrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array
): Uint8Array {
  return xchacha20(key, nonce, plaintext);
}

/** Decrypt ciphertext with XChaCha20 (unauthenticated stream cipher). */
export function xchacha20Decrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array
): Uint8Array {
  // XChaCha20 is symmetric: encrypt === decrypt
  return xchacha20(key, nonce, ciphertext);
}

/**
 * Sign data with Ed25519.
 * @param signSk 32-byte seed (noble uses seed, not Go's 64-byte seed+pk)
 */
export function ed25519Sign(
  signSk: Uint8Array,
  data: Uint8Array
): Uint8Array {
  return ed25519.sign(data, signSk);
}

/**
 * Verify Ed25519 signature.
 * Note: noble arg order is verify(sig, msg, pk) — different from Go's Verify(pk, msg, sig).
 */
export function ed25519Verify(
  signPk: Uint8Array,
  data: Uint8Array,
  signature: Uint8Array
): boolean {
  return ed25519.verify(signature, data, signPk);
}

/**
 * Compute EncryptSkID from the encryption secret key.
 * BLAKE2b with dkLen=8, personalization="PK" (16-byte padded), then clear MSB of last byte.
 */
export function computeEncryptSkId(encryptSk: Uint8Array): Uint8Array {
  const id = blake2b(encryptSk, {
    personalization: PERSON,
    dkLen: 8,
  });
  id[7] &= 0x7f;
  return id;
}

/** Generate a random nonce (24 bytes for XChaCha20). */
export function generateNonce(): Uint8Array {
  return randomBytes(24);
}

/** Generate 32 random bytes (for handshake r). */
export function generateRandom(n: number): Uint8Array {
  return randomBytes(n);
}

/**
 * Encrypt data for storage: builds ekid || nonce || ciphertext, then signs.
 * Returns { encryptedPayload, signature }.
 */
export function encryptAndSign(
  encryptSk: Uint8Array,
  encryptSkId: Uint8Array,
  signSk: Uint8Array,
  plaintext: Uint8Array
): { payload: Uint8Array; signature: Uint8Array } {
  const nonce = generateNonce();
  const ciphertext = xchacha20Encrypt(encryptSk, nonce, plaintext);
  const payload = concat(encryptSkId, nonce, ciphertext);
  const signature = ed25519Sign(signSk, payload);
  return { payload, signature };
}

/**
 * Verify and decrypt data from server.
 * @param payload ekid(8) || nonce(24) || ciphertext(N)
 */
export function verifyAndDecrypt(
  encryptSk: Uint8Array,
  encryptSkId: Uint8Array,
  signPk: Uint8Array,
  payload: Uint8Array,
  signature: Uint8Array
): Uint8Array {
  // Verify encryption key ID
  const receivedSkId = payload.slice(0, 8);
  let match = true;
  for (let i = 0; i < 8; i++) {
    if (receivedSkId[i] !== encryptSkId[i]) {
      match = false;
      break;
    }
  }
  if (!match) {
    throw new Error("Encryption key ID mismatch");
  }

  // Verify signature over entire payload
  if (!ed25519Verify(signPk, payload, signature)) {
    throw new Error("Signature doesn't verify");
  }

  // Decrypt
  const nonce = payload.slice(8, 32);
  const ciphertext = payload.slice(32);
  return xchacha20Decrypt(encryptSk, nonce, ciphertext);
}
