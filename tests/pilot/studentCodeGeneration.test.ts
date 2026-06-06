import { describe, it, expect } from 'vitest';
import { generateStudentAccessCodes } from '../../backend/services/pilotSetupService';
import { hashCode } from '../../backend/lib/hash';
import type { RequestContext } from '../../backend/lib/requestContext';

const teacher: RequestContext = { mode: 'supabase_user', userId: 't1', role: 'teacher' };
const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('generateStudentAccessCodes (mock path)', () => {
  it('generates the requested number of pseudonymous codes', async () => {
    const result = await generateStudentAccessCodes(teacher, { classId: UUID, count: 5, pseudonymPrefix: 'Líška' });
    expect(result.ok).toBe(true);
    expect(result.oneTimeView).toBe(true);
    expect(result.codes).toHaveLength(5);
    expect(result.codes?.[0].pseudonym).toBe('Líška-01');
    expect(result.codes?.[4].pseudonym).toBe('Líška-05');
  });

  it('enforces the count limit (max 40)', async () => {
    const result = await generateStudentAccessCodes(teacher, { classId: UUID, count: 99, pseudonymPrefix: 'Líška' });
    expect(result.ok).toBe(false);
  });

  it('plaintext code is NOT what gets stored — only its hash differs', async () => {
    const result = await generateStudentAccessCodes(teacher, { classId: UUID, count: 1, pseudonymPrefix: 'Líška' });
    const code = result.codes?.[0].code ?? '';
    expect(code.length).toBeGreaterThan(0);
    const stored = hashCode(code);
    expect(stored).not.toBe(code);
    expect(stored).toMatch(/^[a-f0-9]{64}$/);
  });

  it('pseudonyms contain no e-mail or real name', async () => {
    const result = await generateStudentAccessCodes(teacher, { classId: UUID, count: 3, pseudonymPrefix: 'Líška' });
    for (const c of result.codes ?? []) {
      expect(c.pseudonym).toMatch(/^Líška-\d{2}$/);
      expect(c.pseudonym).not.toContain('@');
    }
  });
});
