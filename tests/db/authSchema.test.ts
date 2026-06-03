import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../');
const migration002 = readFileSync(
  resolve(root, 'supabase', 'migrations', '002_auth_and_student_access.sql'),
  'utf8',
).toLowerCase();
const migration001 = readFileSync(
  resolve(root, 'supabase', 'migrations', '001_initial_schema.sql'),
  'utf8',
).toLowerCase();

const NEW_TABLES = ['class_join_codes', 'student_access_codes', 'student_sessions'];

describe('auth & student access migration (002)', () => {
  it('creates the new tables', () => {
    for (const table of NEW_TABLES) {
      expect(migration002).toContain(`create table if not exists public.${table} `);
    }
  });

  it('enables RLS on every new table', () => {
    for (const table of NEW_TABLES) {
      expect(migration002).toContain(`alter table public.${table}`);
    }
    const rlsEnables = migration002.match(/enable row level security/g) ?? [];
    expect(rlsEnables.length).toBeGreaterThanOrEqual(NEW_TABLES.length);
  });

  it('stores codes/tokens as hashes, never plaintext', () => {
    expect(migration002).toContain('code_hash');
    expect(migration002).toContain('session_token_hash');
    // No plaintext `code text` column anywhere.
    expect(migration002).not.toMatch(/\bcode\b\s+text/);
  });

  it('defines RLS policies for the new tables', () => {
    expect(migration002).toContain('create policy');
  });
});

describe('role model (001)', () => {
  it('restricts roles to admin / teacher / student', () => {
    expect(migration001).toContain("role in ('admin', 'teacher', 'student')");
  });
});
