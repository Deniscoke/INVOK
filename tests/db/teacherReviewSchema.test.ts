import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../');
const migration = readFileSync(
  resolve(root, 'supabase', 'migrations', '004_teacher_review_workflow.sql'),
  'utf8',
).toLowerCase();

describe('teacher review migration (004)', () => {
  it('creates the teacher_reviews table', () => {
    expect(migration).toContain('create table if not exists public.teacher_reviews');
  });

  it('restricts decision to the four valid values', () => {
    expect(migration).toContain("decision in ('approved', 'adjusted', 'needs_revision', 'rejected')");
  });

  it('clamps final_score between 0 and 100', () => {
    expect(migration).toContain('final_score');
    expect(migration).toContain('between 0 and 100');
  });

  it('adds the rejected submission status', () => {
    expect(migration).toContain('rejected');
    expect(migration).toContain('submissions_status_check');
  });

  it('enables RLS and defines policies', () => {
    expect(migration).toContain('alter table public.teacher_reviews enable row level security');
    expect(migration).toContain('create policy');
    expect(migration).toContain('auth.uid()');
  });

  it('indexes submission, reviewer and decision', () => {
    expect(migration).toContain('idx_teacher_reviews_submission');
    expect(migration).toContain('idx_teacher_reviews_reviewer');
    expect(migration).toContain('idx_teacher_reviews_decision');
  });

  it('is auditable (has timestamps)', () => {
    expect(migration).toContain('created_at');
    expect(migration).toContain('updated_at');
  });
});
