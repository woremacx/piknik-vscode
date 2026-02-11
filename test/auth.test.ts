import { describe, it, expect } from "vitest";
import { auth0, auth1, auth2get, auth2store, auth3get, auth3store } from "../src/protocol/auth.js";
import { hexDecode, hexEncode } from "../src/protocol/util.js";

// Test keys from test.sh
const PSK = hexDecode("627ea393638048bc0d5a7554ab58e41e5601e2f4975a214dfc53b500be462a9a");

describe("auth functions", () => {
  it("auth0 produces 32-byte output", () => {
    const r = new Uint8Array(32);
    r.fill(0x42);
    const h0 = auth0(PSK, 6, r);
    expect(h0.length).toBe(32);
  });

  it("auth0 is deterministic", () => {
    const r = new Uint8Array(32);
    r.fill(0xAB);
    const h0a = auth0(PSK, 6, r);
    const h0b = auth0(PSK, 6, r);
    expect(hexEncode(h0a)).toBe(hexEncode(h0b));
  });

  it("auth0 changes with different r", () => {
    const r1 = new Uint8Array(32);
    r1.fill(0x01);
    const r2 = new Uint8Array(32);
    r2.fill(0x02);
    const h0a = auth0(PSK, 6, r1);
    const h0b = auth0(PSK, 6, r2);
    expect(hexEncode(h0a)).not.toBe(hexEncode(h0b));
  });

  it("auth1 produces 32-byte output", () => {
    const h0 = new Uint8Array(32);
    const r2 = new Uint8Array(32);
    r2.fill(0x55);
    const h1 = auth1(PSK, 6, h0, r2);
    expect(h1.length).toBe(32);
  });

  it("auth2get produces 32-byte output", () => {
    const h1 = new Uint8Array(32);
    h1.fill(0x11);
    const h2 = auth2get(PSK, h1, 0x47); // 'G'
    expect(h2.length).toBe(32);
  });

  it("auth2store produces 32-byte output", () => {
    const h1 = new Uint8Array(32);
    const ts = new Uint8Array(8);
    const sig = new Uint8Array(64);
    const h2 = auth2store(PSK, h1, 0x53, ts, sig);
    expect(h2.length).toBe(32);
  });

  it("auth3get produces 32-byte output", () => {
    const h2 = new Uint8Array(32);
    const ts = new Uint8Array(8);
    const sig = new Uint8Array(64);
    const h3 = auth3get(PSK, h2, ts, sig);
    expect(h3.length).toBe(32);
  });

  it("auth3store produces 32-byte output", () => {
    const h2 = new Uint8Array(32);
    const h3 = auth3store(PSK, h2);
    expect(h3.length).toBe(32);
  });

  it("auth2get and auth2store differ for same h1", () => {
    const h1 = new Uint8Array(32);
    h1.fill(0x33);
    const ts = new Uint8Array(8);
    const sig = new Uint8Array(64);
    const h2get = auth2get(PSK, h1, 0x47);
    const h2store = auth2store(PSK, h1, 0x53, ts, sig);
    expect(hexEncode(h2get)).not.toBe(hexEncode(h2store));
  });
});
