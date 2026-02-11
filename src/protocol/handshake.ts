import * as net from "net";
import { PROTOCOL_VERSION } from "./constants.js";
import { auth0, auth1 } from "./auth.js";
import { concat } from "./binary.js";
import { constantTimeEqual } from "./util.js";
import { generateRandom } from "./crypto.js";

/**
 * Read exactly `n` bytes from a socket. Accumulates chunks until enough data.
 */
export function readExactly(
  socket: net.Socket,
  n: number
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;

    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      received += chunk.length;
      if (received >= n) {
        socket.removeListener("data", onData);
        socket.removeListener("error", onError);
        socket.removeListener("close", onClose);
        const full = Buffer.concat(chunks);
        // Put back any extra bytes
        if (full.length > n) {
          socket.unshift(full.subarray(n));
        }
        resolve(new Uint8Array(full.subarray(0, n)));
      }
    };

    const onError = (err: Error) => {
      socket.removeListener("data", onData);
      socket.removeListener("close", onClose);
      reject(err);
    };

    const onClose = () => {
      socket.removeListener("data", onData);
      socket.removeListener("error", onError);
      reject(
        new Error(
          `Connection closed after ${received} bytes (expected ${n})`
        )
      );
    };

    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("close", onClose);
  });
}

export interface HandshakeResult {
  socket: net.Socket;
  h1: Uint8Array;
}

/**
 * Connect to server and perform mutual authentication handshake.
 * Returns the socket and h1 (used for subsequent auth).
 */
export function performHandshake(
  host: string,
  port: number,
  psk: Uint8Array,
  timeoutMs: number
): Promise<HandshakeResult> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, async () => {
      try {
        socket.setTimeout(timeoutMs);

        // Generate random challenge
        const r = generateRandom(32);
        const version = PROTOCOL_VERSION;
        const h0 = auth0(psk, version, r);

        // Send: version(1) || r(32) || h0(32) = 65 bytes
        const clientHello = concat(
          new Uint8Array([version]),
          r,
          h0
        );
        socket.write(clientHello);

        // Read server response: version(1) || r'(32) || h1(32) = 65 bytes
        let serverHello: Uint8Array;
        try {
          serverHello = await readExactly(socket, 65);
        } catch {
          socket.destroy();
          reject(
            new Error(
              "The server rejected the connection - Check that it is running the same Piknik version or retry later"
            )
          );
          return;
        }

        const serverVersion = serverHello[0];
        if (serverVersion !== version) {
          socket.destroy();
          reject(
            new Error(
              `Incompatible server version (client: ${version}, server: ${serverVersion})`
            )
          );
          return;
        }

        const r2 = serverHello.slice(1, 33);
        const h1 = serverHello.slice(33, 65);

        // Verify server authentication
        const wh1 = auth1(psk, version, h0, r2);
        if (!constantTimeEqual(wh1, h1)) {
          socket.destroy();
          reject(new Error("Incorrect authentication code"));
          return;
        }

        resolve({ socket, h1 });
      } catch (err) {
        socket.destroy();
        reject(err);
      }
    });

    socket.setTimeout(timeoutMs);

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Connection timed out"));
    });

    socket.on("error", (err) => {
      reject(
        new Error(
          `Unable to connect to ${host}:${port} - Is a Piknik server running on that host? (${err.message})`
        )
      );
    });
  });
}
