/**
 * Server-only hashing helpers for access codes and session tokens.
 *
 * Codes/tokens are NEVER stored in plaintext. We use deterministic SHA-256 so
 * a submitted code/token can be looked up by hashing the input and matching
 * the stored hash (a per-row salted hash could not be queried this way).
 * Risk from low-entropy human codes is mitigated by expiry, max_uses and
 * server-only validation — see docs/SECURITY.md.
 *
 * Do NOT import from frontend code.
 */
import { createHash, randomBytes } from 'node:crypto';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Normalize a human-typed code (trim, uppercase, drop inner whitespace). */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function hashCode(code: string): string {
  return sha256Hex(normalizeCode(code));
}

export function hashToken(token: string): string {
  return sha256Hex(token);
}

/** Generate a human-friendly code (no ambiguous chars like 0/O, 1/I). */
export function generateCode(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

/** High-entropy opaque session token (returned to client once). */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}
