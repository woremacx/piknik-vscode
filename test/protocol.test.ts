import { describe, it, expect } from "vitest";
import { writeUint64LE, readUint64LE, concat } from "../src/protocol/binary.js";
import { hexDecode, hexEncode, constantTimeEqual } from "../src/protocol/util.js";
import { computeEncryptSkId } from "../src/protocol/crypto.js";

// Test keys from test.sh
const ENCRYPT_SK = hexDecode("f313e1fd4ad5fee8841d40ca3d54e14041eb05bf7f4888ad8c800ceb61942db6");

describe("binary helpers", () => {
  it("writeUint64LE and readUint64LE roundtrip", () => {
    const values = [0, 1, 255, 65535, 1000000, 2 ** 32 - 1, 2 ** 48];
    for (const v of values) {
      const buf = writeUint64LE(v);
      expect(buf.length).toBe(8);
      expect(readUint64LE(buf)).toBe(v);
    }
  });

  it("writeUint64LE is little-endian", () => {
    const buf = writeUint64LE(1);
    expect(buf[0]).toBe(1);
    expect(buf[7]).toBe(0);
  });

  it("concat concatenates correctly", () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3, 4, 5]);
    const c = concat(a, b);
    expect(c.length).toBe(5);
    expect(Array.from(c)).toEqual([1, 2, 3, 4, 5]);
  });

  it("concat handles empty arrays", () => {
    const a = new Uint8Array(0);
    const b = new Uint8Array([1]);
    expect(concat(a, b).length).toBe(1);
    expect(concat(a, a).length).toBe(0);
  });
});

describe("util helpers", () => {
  it("hexDecode and hexEncode roundtrip", () => {
    const hex = "deadbeef0102030405060708090a0b0c0d0e0f10";
    const bytes = hexDecode(hex);
    expect(hexEncode(bytes)).toBe(hex);
  });

  it("hexDecode rejects odd-length strings", () => {
    expect(() => hexDecode("abc")).toThrow();
  });

  it("constantTimeEqual returns true for equal arrays", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3]);
    expect(constantTimeEqual(a, b)).toBe(true);
  });

  it("constantTimeEqual returns false for different arrays", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 4]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });

  it("constantTimeEqual returns false for different lengths", () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([1, 2, 3]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });
});

describe("EncryptSkID computation", () => {
  it("matches between computations", () => {
    // The EncryptSkID computed from the same key should always be the same
    const id1 = computeEncryptSkId(ENCRYPT_SK);
    const id2 = computeEncryptSkId(ENCRYPT_SK);
    expect(hexEncode(id1)).toBe(hexEncode(id2));
  });

  it("has MSB of last byte cleared", () => {
    const id = computeEncryptSkId(ENCRYPT_SK);
    expect(id[7] & 0x80).toBe(0);
  });

  it("different keys produce different IDs", () => {
    const otherKey = new Uint8Array(32);
    otherKey.fill(0xaa);
    const id1 = computeEncryptSkId(ENCRYPT_SK);
    const id2 = computeEncryptSkId(otherKey);
    expect(hexEncode(id1)).not.toBe(hexEncode(id2));
  });
});
