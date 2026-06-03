import { describe, it, expect } from 'vitest';
import { hashCode } from '../../backend/lib/hash';
import {
  joinClass,
  validateJoinInput,
  verifyStudentSession,
} from '../../backend/services/studentAccessService';

describe('student access code hashing', () => {
  it('hashes codes (never stores plaintext) and is stable for lookup', () => {
    const hash = hashCode('ABC123');
    expect(hash).not.toBe('ABC123');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashCode('abc123')).toBe(hash); // normalized (case-insensitive)
  });
});

describe('student join (mock path, no Supabase configured)', () => {
  it('returns a pseudonymous session without leaking any hash', async () => {
    const result = await joinClass({ code: 'ABC123', pseudonym: 'Líška-07' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.studentAlias).toBe('Líška-07');
      expect(result.sessionMode).toBe('pseudonymous');
      expect(result.source).toBe('mock');
      for (const key of Object.keys(result)) {
        expect(key.toLowerCase()).not.toContain('hash');
      }
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('code_hash');
      expect(serialized).not.toContain('session_token_hash');
    }
  });

  it('rejects an e-mail-like pseudonym (no PII)', async () => {
    const result = await joinClass({ code: 'ABC123', pseudonym: 'kid@example.com' });
    expect(result.ok).toBe(false);
  });

  it('rejects an empty / too-short code', () => {
    expect(validateJoinInput({ code: '', pseudonym: 'Líška-07' }).ok).toBe(false);
    expect(validateJoinInput({ code: 'ABCDEF', pseudonym: 'Líška-07' }).ok).toBe(true);
  });
});

describe('student session verification (mock path)', () => {
  it('accepts a plausible token and never returns a hash', async () => {
    const result = await verifyStudentSession('a'.repeat(43));
    expect(result.valid).toBe(true);
    expect(result.sessionMode).toBe('pseudonymous');
    for (const key of Object.keys(result)) {
      expect(key.toLowerCase()).not.toContain('hash');
    }
  });

  it('rejects an obviously invalid token', async () => {
    const result = await verifyStudentSession('x');
    expect(result.valid).toBe(false);
  });
});
