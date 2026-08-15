import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Alphabet base32 RFC 4648. */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_ALGORITHM = 'SHA1';

/** Tolérance appliquée de part et d'autre de la fenêtre courante (dérive d'horloge). */
export const TOTP_WINDOW_TOLERANCE = 1;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** Le rembourrage et les séparateurs sont ignorés à la lecture. */
export function base32Decode(secret: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of secret.toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

function counterBuffer(counter: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);
  return buffer;
}

function counterAt(timestamp: number): number {
  return Math.floor(timestamp / 1000 / TOTP_PERIOD_SECONDS);
}

function hotp(key: Buffer, counter: number): string {
  const digest = createHmac('sha1', key).update(counterBuffer(counter)).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const truncated =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(truncated % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

export function generateCode(secret: string, timestamp: number = Date.now()): string {
  const key = base32Decode(secret);
  if (key.length === 0) return ''.padStart(TOTP_DIGITS, '0');
  return hotp(key, counterAt(timestamp));
}

function equalsInConstantTime(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyCode(
  secret: string,
  code: string,
  timestamp: number = Date.now(),
): boolean {
  const key = base32Decode(secret);
  const candidate = String(code ?? '').replace(/\D/g, '');
  if (key.length === 0 || candidate.length !== TOTP_DIGITS) return false;

  const counter = counterAt(timestamp);
  let matched = false;
  for (let drift = -TOTP_WINDOW_TOLERANCE; drift <= TOTP_WINDOW_TOLERANCE; drift += 1) {
    const expected = hotp(key, counter + drift);
    matched = equalsInConstantTime(expected, candidate) || matched;
  }
  return matched;
}

export function buildOtpauthUrl(params: { issuer: string; email: string; secret: string }): string {
  return (
    `otpauth://totp/${params.issuer}:${params.email}` +
    `?secret=${params.secret}&issuer=${params.issuer}` +
    `&algorithm=${TOTP_ALGORITHM}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`
  );
}
