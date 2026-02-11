export const PROTOCOL_VERSION = 6;
export const DOMAIN_STR = "PK";
export const DEFAULT_CONNECT = "127.0.0.1:8075";
export const DEFAULT_TIMEOUT_SECS = 10;
export const DEFAULT_DATA_TIMEOUT_SECS = 3600;
export const DEFAULT_TTL_SECS = 7 * 24 * 3600; // 604800

/** BLAKE2b personalization: "PK" padded to 16 bytes */
export const PERSON = new Uint8Array(16);
PERSON[0] = 0x50; // 'P'
PERSON[1] = 0x4b; // 'K'

export const OPCODE_STORE = 0x53; // 'S'
export const OPCODE_GET = 0x47; // 'G'
export const OPCODE_MOVE = 0x4d; // 'M'
