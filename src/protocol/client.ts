import {
  OPCODE_STORE,
  OPCODE_GET,
  OPCODE_MOVE,
} from "./constants.js";
import { writeUint64LE, readUint64LE, concat } from "./binary.js";
import {
  auth2store,
  auth2get,
  auth3store,
  auth3get,
} from "./auth.js";
import { encryptAndSign, verifyAndDecrypt } from "./crypto.js";
import { constantTimeEqual } from "./util.js";
import { performHandshake } from "./handshake.js";

export interface PiknikConfig {
  host: string;
  port: number;
  psk: Uint8Array;
  signPk: Uint8Array;
  signSk: Uint8Array; // 32-byte seed
  encryptSk: Uint8Array;
  encryptSkId: Uint8Array; // 8 bytes
  timeoutMs: number;
  dataTimeoutMs: number;
  ttlSecs: number;
}

/**
 * Copy (store) data to the piknik server.
 */
export async function copyToServer(
  config: PiknikConfig,
  data: Uint8Array
): Promise<void> {
  const { socket, reader, h1 } = await performHandshake(
    config.host,
    config.port,
    config.psk,
    config.timeoutMs
  );

  try {
    // Timestamp (seconds since epoch, LE uint64)
    const ts = writeUint64LE(Math.floor(Date.now() / 1000));

    // Encrypt and sign
    const { payload, signature } = encryptAndSign(
      config.encryptSk,
      config.encryptSkId,
      config.signSk,
      data
    );

    // Set data timeout
    socket.setTimeout(config.dataTimeoutMs);

    // Compute auth
    const opcode = OPCODE_STORE;
    const h2 = auth2store(config.psk, h1, opcode, ts, signature);

    // Send: opcode(1) || h2(32) || len(8 LE) || ts(8 LE) || sig(64) || payload(N)
    const header = concat(
      new Uint8Array([opcode]),
      h2,
      writeUint64LE(payload.length),
      ts,
      signature
    );
    socket.write(header);
    socket.write(payload);

    // Read server confirmation: h3(32)
    const h3 = await reader.read(32);
    const wh3 = auth3store(config.psk, h2);
    if (!constantTimeEqual(wh3, h3)) {
      throw new Error("Incorrect authentication code from server");
    }
  } finally {
    socket.destroy();
  }
}

/**
 * Paste (retrieve) data from the piknik server.
 * @param isMove If true, server deletes the content after retrieval.
 */
export async function pasteFromServer(
  config: PiknikConfig,
  isMove: boolean = false
): Promise<Uint8Array> {
  const { socket, reader, h1 } = await performHandshake(
    config.host,
    config.port,
    config.psk,
    config.timeoutMs
  );

  try {
    const opcode = isMove ? OPCODE_MOVE : OPCODE_GET;
    const h2 = auth2get(config.psk, h1, opcode);

    // Send: opcode(1) || h2(32)
    socket.write(concat(new Uint8Array([opcode]), h2));

    // Read response header: h3(32) || len(8 LE) || ts(8 LE) || sig(64) = 112 bytes
    let rbuf: Uint8Array;
    try {
      rbuf = await reader.read(112);
    } catch {
      throw new Error("The clipboard might be empty");
    }

    const h3 = rbuf.slice(0, 32);
    const payloadLen = readUint64LE(rbuf, 32);
    const ts = rbuf.slice(40, 48);
    const signature = rbuf.slice(48, 112);

    // Verify auth
    const wh3 = auth3get(config.psk, h2, ts, signature);
    if (!constantTimeEqual(wh3, h3)) {
      throw new Error("Incorrect authentication code from server");
    }

    // Check TTL
    const tsSecs = readUint64LE(ts, 0);
    const elapsed = Math.floor(Date.now() / 1000) - tsSecs;
    if (elapsed >= config.ttlSecs) {
      throw new Error("Clipboard content is too old");
    }

    if (payloadLen < 8 + 24) {
      throw new Error("Clipboard content is too short");
    }

    // Read payload
    socket.setTimeout(config.dataTimeoutMs);
    const payload = await reader.read(payloadLen);

    // Verify and decrypt
    return verifyAndDecrypt(
      config.encryptSk,
      config.encryptSkId,
      config.signPk,
      payload,
      signature
    );
  } finally {
    socket.destroy();
  }
}
