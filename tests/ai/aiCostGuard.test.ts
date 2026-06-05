import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { validateSubmissionWithAI } from '../../backend/services/aiValidationService';
import { validateSubmissionInput, SUBMISSION_LIMITS } from '../../backend/validators/submissionValidator';
import { getServerEnv } from '../../backend/lib/env';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../');

const input = {
  missionId: 'design_solution',
  studentResponse: 'Navrhujem riešenie, pretože som zistil problém. Prvý krok je plán.',
  evidenceText: 'Mám dôkaz z pozorovania, tri dni som sledoval situáciu.',
  evidenceType: 'text' as const,
};

describe('AI cost-guard env defaults', () => {
  it('has conservative limits when env is unset', () => {
    const env = getServerEnv();
    expect(env.aiMaxEvidenceChars).toBe(5000);
    expect(env.aiMinEvidenceChars).toBe(20);
    expect(env.aiRateLimitMaxPerStudent).toBe(5);
    expect(env.aiRateLimitMaxPerTeacher).toBe(20);
    expect(env.aiDailyMaxPerStudent).toBe(30);
    expect(env.aiDailyMaxPerClass).toBe(300);
  });
});

describe('forceMock (anonymous must not spend OpenAI credit)', () => {
  it('returns a mock result when forceMock is set', async () => {
    const result = await validateSubmissionWithAI(input, {}, { forceMock: true });
    expect(result.source).toBe('mock');
  });

  it('falls back to mock when no OpenAI key is configured', async () => {
    const result = await validateSubmissionWithAI(input);
    expect(result.source).toBe('mock');
  });
});

describe('evidence length cost guard (validator)', () => {
  it('rejects a too-short response', () => {
    expect(validateSubmissionInput({ ...input, studentResponse: 'krátke' }).ok).toBe(false);
  });

  it('rejects evidence over the max length', () => {
    const tooLong = 'a'.repeat(SUBMISSION_LIMITS.evidenceMax + 1);
    expect(validateSubmissionInput({ ...input, evidenceText: tooLong }).ok).toBe(false);
  });
});

describe('OpenAI SDK never reaches the frontend', () => {
  it('frontend sources do not import openai / openaiClient / the key', () => {
    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else out.push(full);
      }
      return out;
    }
    const sources = walk(resolve(root, 'frontend', 'src'))
      .filter((f) => /\.(ts|css|html)$/.test(f))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(sources).not.toContain("from 'openai'");
    expect(sources).not.toMatch(/import[^\n]*openaiClient/i);
    expect(sources).not.toContain('OPENAI_API_KEY');
  });
});
