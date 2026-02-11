import * as net from "net";
import { PROTOCOL_VERSION } from "./constants.js";
import { auth0, auth1 } from "./auth.js";
import { concat } from "./binary.js";
import { constantTimeEqual } from "./util.js";
import { generateRandom } from "./crypto.js";

/**
 * Buffered reader over a net.Socket.
 * Maintains an internal buffer so data is never lost between reads.
 */
export class SocketReader {
  private socket: net.Socket;
  private buf: Buffer = Buffer.alloc(0);
  private waiting:
    | {
        n: number;
        resolve: (data: Uint8Array) => void;
        reject: (err: Error) => void;
      }
    | undefined;
  private error: Error | undefined;
  private closed = false;

  constructor(socket: net.Socket) {
    this.socket = socket;
    socket.on("data", (chunk: Buffer) => {
      this.buf = Buffer.concat([this.buf, chunk]);
      this.flush();
    });
    socket.on("error", (err: Error) => {
      this.error = err;
      this.flush();
    });
    socket.on("close", () => {
      this.closed = true;
      this.flush();
    });
  }

  private flush(): void {
    if (!this.waiting) return;
    const { n, resolve, reject } = this.waiting;
    if (this.buf.length >= n) {
      this.waiting = undefined;
      const result = new Uint8Array(this.buf.subarray(0, n));
      this.buf = this.buf.subarray(n);
      resolve(result);
    } else if (this.error) {
      this.waiting = undefined;
      reject(this.error);
    } else if (this.closed) {
      this.waiting = undefined;
      reject(
        new Error(
          `Connection closed after ${this.buf.length} bytes (expected ${n})`
        )
      );
    }
  }

  read(n: number): Promise<Uint8Array> {
    // Already have enough buffered
    if (this.buf.length >= n) {
      const result = new Uint8Array(this.buf.subarray(0, n));
      this.buf = this.buf.subarray(n);
      return Promise.resolve(result);
    }
    if (this.error) return Promise.reject(this.error);
    if (this.closed) {
      return Promise.reject(
        new Error(
          `Connection closed after ${this.buf.length} bytes (expected ${n})`
        )
      );
    }
    return new Promise((resolve, reject) => {
      this.waiting = { n, resolve, reject };
    });
  }
}

export interface HandshakeResult {
  socket: net.Socket;
  reader: SocketReader;
  h1: Uint8Array;
}

/**
 * Connect to server and perform mutual authentication handshake.
 * Returns the socket, a buffered reader, and h1 (used for subsequent auth).
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
        const reader = new SocketReader(socket);

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
          serverHello = await reader.read(65);
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

        resolve({ socket, reader, h1 });
      } catch (err) {
        socket.destroy();
        reject(err as Error);
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
