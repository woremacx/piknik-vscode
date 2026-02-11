import { describe, it, expect } from "vitest";
import {
  xchacha20Encrypt,
  xchacha20Decrypt,
  ed25519Sign,
  ed25519Verify,
  computeEncryptSkId,
  encryptAndSign,
  verifyAndDecrypt,
} from "../src/protocol/crypto.js";
import { hexDecode, hexEncode } from "../src/protocol/util.js";

// Test keys from test.sh
const SIGN_SK = hexDecode("7599dad4726247d301c00ce0dc0dbfb9144fa958b4e9db30209a8f9d840ac9ca");
const SIGN_PK = hexDecode("c2e46983e667a37d7d8d69679f40f3a05eb8086337693d91dcaf8546d39ddb5e");
const ENCRYPT_SK = hexDecode("f313e1fd4ad5fee8841d40ca3d54e14041eb05bf7f4888ad8c800ceb61942db6");

describe("XChaCha20", () => {
  it("encrypt then decrypt roundtrips", () => {
    const key = new Uint8Array(32);
    key.fill(0x42);
    const nonce = new Uint8Array(24);
    nonce.fill(0x01);
    const plaintext = new TextEncoder().encode("hello piknik");

    const ciphertext = xchacha20Encrypt(key, nonce, plaintext);
    expect(ciphertext.length).toBe(plaintext.length);
    expect(hexEncode(ciphertext)).not.toBe(hexEncode(plaintext));

    const decrypted = xchacha20Decrypt(key, nonce, ciphertext);
    expect(new TextDecoder().decode(decrypted)).toBe("hello piknik");
  });
});

describe("Ed25519", () => {
  it("sign and verify with test keys", () => {
    const message = new TextEncoder().encode("test message");
    const sig = ed25519Sign(SIGN_SK, message);
    expect(sig.length).toBe(64);
    expect(ed25519Verify(SIGN_PK, message, sig)).toBe(true);
  });

  it("verify fails with wrong message", () => {
    const message = new TextEncoder().encode("test message");
    const sig = ed25519Sign(SIGN_SK, message);
    const wrong = new TextEncoder().encode("wrong message");
    expect(ed25519Verify(SIGN_PK, wrong, sig)).toBe(false);
  });
});

describe("computeEncryptSkId", () => {
  it("produces 8 bytes with MSB cleared", () => {
    const id = computeEncryptSkId(ENCRYPT_SK);
    expect(id.length).toBe(8);
    expect(id[7] & 0x80).toBe(0); // MSB is cleared
  });

  it("is deterministic", () => {
    const id1 = computeEncryptSkId(ENCRYPT_SK);
    const id2 = computeEncryptSkId(ENCRYPT_SK);
    expect(hexEncode(id1)).toBe(hexEncode(id2));
  });
});

describe("encryptAndSign / verifyAndDecrypt roundtrip", () => {
  it("roundtrips correctly", () => {
    const encryptSkId = computeEncryptSkId(ENCRYPT_SK);
    const plaintext = new TextEncoder().encode("secure data");

    const { payload, signature } = encryptAndSign(
      ENCRYPT_SK,
      encryptSkId,
      SIGN_SK,
      plaintext
    );

    // payload should be: ekid(8) + nonce(24) + ciphertext(len(plaintext))
    expect(payload.length).toBe(8 + 24 + plaintext.length);
    expect(signature.length).toBe(64);

    const decrypted = verifyAndDecrypt(
      ENCRYPT_SK,
      encryptSkId,
      SIGN_PK,
      payload,
      signature
    );

    expect(new TextDecoder().decode(decrypted)).toBe("secure data");
  });

  it("detects key ID mismatch", () => {
    const encryptSkId = computeEncryptSkId(ENCRYPT_SK);
    const wrongId = new Uint8Array(8);
    wrongId.fill(0xff);

    const { payload, signature } = encryptAndSign(
      ENCRYPT_SK,
      encryptSkId,
      SIGN_SK,
      new Uint8Array([1, 2, 3])
    );

    expect(() =>
      verifyAndDecrypt(ENCRYPT_SK, wrongId, SIGN_PK, payload, signature)
    ).toThrow("Encryption key ID mismatch");
  });
});
