import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../');
const migration = readFileSync(
  resolve(root, 'supabase', 'migrations', '001_initial_schema.sql'),
  'utf8',
).toLowerCase();

const TABLES = [
  'profiles',
  'schools',
  'school_memberships',
  'classes',
  'class_memberships',
  'competencies',
  'missions',
  'mission_competencies',
  'submissions',
  'ai_evaluations',
  'badges',
  'user_badges',
  'user_progress',
];

describe('initial migration', () => {
  it('creates all core tables', () => {
    for (const table of TABLES) {
      expect(migration).toContain(`create table if not exists public.${table} `);
    }
  });

  it('enables Row Level Security on every table', () => {
    for (const table of TABLES) {
      expect(migration).toContain(`alter table public.${table}`);
    }
    const rlsEnables = migration.match(/enable row level security/g) ?? [];
    expect(rlsEnables.length).toBeGreaterThanOrEqual(TABLES.length);
  });

  it('defines RLS policies bound to auth.uid()', () => {
    expect(migration).toContain('create policy');
    expect(migration).toContain('auth.uid()');
  });
});
