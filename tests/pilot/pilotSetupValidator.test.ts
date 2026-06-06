import { describe, it, expect } from 'vitest';
import {
  validateSchoolInput,
  validateClassInput,
  validateStudentCodesInput,
  validateTeacherInput,
} from '../../backend/validators/pilotSetupValidator';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('validateSchoolInput', () => {
  it('accepts a valid name', () => {
    expect(validateSchoolInput({ schoolName: 'ZŠ Príklad' }).ok).toBe(true);
  });
  it('rejects an empty name', () => {
    expect(validateSchoolInput({ schoolName: '' }).ok).toBe(false);
  });
  it('rejects a name over 120 chars', () => {
    expect(validateSchoolInput({ schoolName: 'a'.repeat(121) }).ok).toBe(false);
  });
  it('rejects HTML/script payloads', () => {
    expect(validateSchoolInput({ schoolName: '<script>x</script>' }).ok).toBe(false);
  });
});

describe('validateClassInput', () => {
  it('accepts a UUID schoolId + name', () => {
    const r = validateClassInput({ schoolId: UUID, className: 'Trieda 5.A', grade: 5 });
    expect(r.ok).toBe(true);
  });
  it('rejects a non-UUID schoolId', () => {
    expect(validateClassInput({ schoolId: 'demo', className: 'A' }).ok).toBe(false);
  });
  it('rejects a grade outside 1–9', () => {
    expect(validateClassInput({ schoolId: UUID, className: 'A', grade: 12 }).ok).toBe(false);
  });
});

describe('validateStudentCodesInput', () => {
  it('accepts count within 1–40', () => {
    const r = validateStudentCodesInput({ classId: UUID, count: 24, pseudonymPrefix: 'Líška' });
    expect(r.ok).toBe(true);
  });
  it('rejects count over 40', () => {
    expect(validateStudentCodesInput({ classId: UUID, count: 50, pseudonymPrefix: 'Líška' }).ok).toBe(false);
  });
  it('rejects count below 1', () => {
    expect(validateStudentCodesInput({ classId: UUID, count: 0, pseudonymPrefix: 'Líška' }).ok).toBe(false);
  });
  it('rejects an e-mail-like prefix', () => {
    expect(validateStudentCodesInput({ classId: UUID, count: 5, pseudonymPrefix: 'a@b.com' }).ok).toBe(false);
  });
});

describe('validateTeacherInput', () => {
  it('accepts a valid e-mail', () => {
    expect(validateTeacherInput({ schoolId: UUID, teacherEmail: 'ucitel@skola.sk' }).ok).toBe(true);
  });
  it('rejects an invalid e-mail', () => {
    expect(validateTeacherInput({ schoolId: UUID, teacherEmail: 'not-an-email' }).ok).toBe(false);
  });
});
