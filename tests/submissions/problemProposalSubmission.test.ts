import { describe, it, expect } from 'vitest';
import { validateSubmissionInput } from '../../backend/validators/submissionValidator';
import { createSubmission } from '../../backend/services/submissionService';
import type { RequestContext } from '../../backend/lib/requestContext';

const studentCtx: RequestContext = {
  mode: 'student_session',
  studentAccessCodeId: 'c1',
  pseudonym: 'Líška-07',
  classId: 'class-1',
};

const proposalBody = {
  missionId: 'map_school_problem',
  studentResponse:
    'Problém: dlhé rady v jedálni. Koho sa týka: žiakov. Čo som si všimol: tri dni som meral ' +
    'čas a videl dôkaz, že je to problém. Prvý nápad: rozdeliť príchod tried.',
  evidenceText: 'Tri dni som meral čas čakania.',
  evidenceType: 'text',
  submissionKind: 'problem_proposal',
};

describe('submissionKind validation', () => {
  it('accepts problem_proposal and keeps the kind', () => {
    const result = validateSubmissionInput(proposalBody);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.submissionKind).toBe('problem_proposal');
  });

  it('defaults to solution_submission when omitted', () => {
    const { submissionKind, ...rest } = proposalBody;
    void submissionKind;
    const result = validateSubmissionInput(rest);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.submissionKind).toBe('solution_submission');
  });

  it('rejects an unknown submissionKind', () => {
    const result = validateSubmissionInput({ ...proposalBody, submissionKind: 'nonsense' });
    expect(result.ok).toBe(false);
  });

  it('still rejects HTML/script payloads', () => {
    const result = validateSubmissionInput({ ...proposalBody, studentResponse: '<script>alert(1)</script> aaaaaaaaaaaaaaaaaaaa' });
    expect(result.ok).toBe(false);
  });
});

describe('createSubmission for a problem proposal (mock path)', () => {
  it('returns provisional reward XP and the proposal kind', async () => {
    const parsed = validateSubmissionInput(proposalBody);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await createSubmission(studentCtx, parsed.value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('problem_proposal');
      expect(result.provisional).toBe(true);
      expect(result.xpAwarded).toBeGreaterThan(0);
      // Provisional reward is capped at 40% of base XP (80) → ≤ 32.
      expect(result.xpAwarded).toBeLessThanOrEqual(32);
    }
  });

  it('a solution submission is not provisional', async () => {
    const parsed = validateSubmissionInput({
      missionId: 'design_solution',
      studentResponse: 'Navrhujem riešenie a vysvetľujem prvý krok, lebo som zistil problém.',
      evidenceText: 'Mám dôkaz z pozorovania.',
      evidenceType: 'text',
    });
    if (!parsed.ok) return;
    const result = await createSubmission(studentCtx, parsed.value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('solution_submission');
      expect(result.provisional).toBe(false);
    }
  });

  it('never leaks secrets or hashes in the response', async () => {
    const parsed = validateSubmissionInput(proposalBody);
    if (!parsed.ok) return;
    const result = await createSubmission(studentCtx, parsed.value);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('code_hash');
    expect(serialized).not.toContain('session_token_hash');
    expect(serialized).not.toContain('SERVICE_ROLE');
    expect(serialized).not.toContain('OPENAI_API_KEY');
  });
});
