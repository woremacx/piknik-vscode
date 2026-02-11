import * as vscode from "vscode";
import {
  DEFAULT_CONNECT,
  DEFAULT_TIMEOUT_SECS,
  DEFAULT_DATA_TIMEOUT_SECS,
  DEFAULT_TTL_SECS,
} from "./protocol/constants.js";
import { hexDecode } from "./protocol/util.js";
import { computeEncryptSkId } from "./protocol/crypto.js";
import { writeUint64LE } from "./protocol/binary.js";
import type { PiknikConfig } from "./protocol/client.js";

export function loadConfig(): PiknikConfig {
  const cfg = vscode.workspace.getConfiguration("piknik");

  const connect = cfg.get<string>("connect", DEFAULT_CONNECT);
  const [host, portStr] = connect.split(":");
  const port = parseInt(portStr, 10);
  if (!host || isNaN(port)) {
    throw new Error(`Invalid connect address: ${connect}`);
  }

  const pskHex = cfg.get<string>("psk", "");
  if (!pskHex || pskHex.length !== 64) {
    throw new Error(
      "piknik.psk must be a 64-character hex string (32 bytes)"
    );
  }
  const psk = hexDecode(pskHex);

  const signPkHex = cfg.get<string>("signPk", "");
  if (!signPkHex || signPkHex.length !== 64) {
    throw new Error(
      "piknik.signPk must be a 64-character hex string (32 bytes)"
    );
  }
  const signPk = hexDecode(signPkHex);

  const signSkHex = cfg.get<string>("signSk", "");
  if (!signSkHex || signSkHex.length !== 64) {
    throw new Error(
      "piknik.signSk must be a 64-character hex string (32 bytes)"
    );
  }
  const signSk = hexDecode(signSkHex);

  const encryptSkHex = cfg.get<string>("encryptSk", "");
  if (!encryptSkHex || encryptSkHex.length !== 64) {
    throw new Error(
      "piknik.encryptSk must be a 64-character hex string (32 bytes)"
    );
  }
  const encryptSk = hexDecode(encryptSkHex);

  const encryptSkIdNum = cfg.get<number>("encryptSkId", 0);
  let encryptSkId: Uint8Array;
  if (encryptSkIdNum > 0) {
    encryptSkId = writeUint64LE(encryptSkIdNum);
  } else {
    encryptSkId = computeEncryptSkId(encryptSk);
  }

  const timeoutSecs = cfg.get<number>("timeout", DEFAULT_TIMEOUT_SECS);
  const dataTimeoutSecs = cfg.get<number>(
    "dataTimeout",
    DEFAULT_DATA_TIMEOUT_SECS
  );
  const ttlSecs = cfg.get<number>("ttl", DEFAULT_TTL_SECS);

  return {
    host,
    port,
    psk,
    signPk,
    signSk,
    encryptSk,
    encryptSkId,
    timeoutMs: timeoutSecs * 1000,
    dataTimeoutMs: dataTimeoutSecs * 1000,
    ttlSecs,
  };
}
