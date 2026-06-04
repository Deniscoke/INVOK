import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../');
const read = (rel: string): string =>
  readFileSync(resolve(root, rel), 'utf8').toLowerCase();

const m001 = read('supabase/migrations/001_initial_schema.sql');
const m003 = read('supabase/migrations/003_submission_workflow.sql');

describe('submissions schema (001 + 003)', () => {
  it('submissions table exists with expected columns', () => {
    expect(m001).toContain('create table if not exists public.submissions');
    expect(m001).toContain('mission_id');
    expect(m001).toContain('response_text');
    expect(m001).toContain('evidence_text');
    expect(m001).toContain('status');
    expect(m001).toContain('xp_awarded');
  });

  it('ai_evaluations table has required columns', () => {
    expect(m001).toContain('create table if not exists public.ai_evaluations');
    expect(m001).toContain('valid');
    expect(m001).toContain('confidence');
    expect(m001).toContain('suggested_teacher_review');
  });

  it('migration 003 adds student_access_code_id to submissions', () => {
    expect(m003).toContain('student_access_code_id');
    expect(m003).toContain('add column if not exists');
  });

  it('migration 003 allows nullable student_id (for pseudonymous students)', () => {
    expect(m003).toContain('drop not null');
  });

  it('migration 003 enforces identity constraint (not fully anonymous)', () => {
    expect(m003).toContain('check');
    expect(m003).toContain('student_id is not null or student_access_code_id is not null');
  });

  it('migration 003 adds status index', () => {
    expect(m003).toContain('idx_submissions_status');
  });

  it('no personal data stored: no email column in submissions', () => {
    expect(m001).not.toMatch(/submissions[\s\S]{0,400}email/);
  });
});
