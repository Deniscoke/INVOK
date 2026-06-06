import { describe, it, expect } from 'vitest';
import { generateStudentAccessCodes, listStudentAccessCodes } from '../../backend/services/pilotSetupService';
import type { RequestContext } from '../../backend/lib/requestContext';

const teacher: RequestContext = { mode: 'supabase_user', userId: 't1', role: 'teacher' };
const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('student code privacy', () => {
  it('the list never exposes plaintext code or hash', async () => {
    const items = await listStudentAccessCodes(teacher, UUID);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const keys = Object.keys(item).map((k) => k.toLowerCase());
      expect(keys).not.toContain('code');
      expect(keys.some((k) => k.includes('hash'))).toBe(false);
      expect(keys.some((k) => k.includes('code'))).toBe(false);
    }
    const serialized = JSON.stringify(items).toLowerCase();
    expect(serialized).not.toContain('hash');
    expect(serialized).not.toContain('code_hash');
  });

  it('generation result carries plaintext once but no hash / secrets', async () => {
    const result = await generateStudentAccessCodes(teacher, { classId: UUID, count: 2, pseudonymPrefix: 'Líška' });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('code_hash');
    expect(serialized.toLowerCase()).not.toContain('hash');
    expect(serialized).not.toContain('SERVICE_ROLE');
    expect(serialized).not.toContain('sk-proj');
    expect(result.oneTimeView).toBe(true);
  });
});
