import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../');

function readDataFile(name: string): string {
  return readFileSync(resolve(root, 'data', name), 'utf8');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const DATA_FILES = ['competencies.json', 'missions.json', 'badges.json', 'seed.json'];

describe('no personal data in mock/seed data', () => {
  it('contains no email addresses', () => {
    for (const file of DATA_FILES) {
      expect(readDataFile(file)).not.toMatch(EMAIL);
    }
  });

  it('uses pseudonymous student aliases, not real names', () => {
    const seed = JSON.parse(readDataFile('seed.json'));
    const aliases: string[] = [
      seed.demoStudent.alias,
      ...seed.demoClass.students.map((s: any) => s.alias),
      ...seed.demoPendingReviews.map((r: any) => r.studentAlias),
    ];
    for (const alias of aliases) {
      // e.g. "Líška-07" — a word followed by a two-digit number
      expect(alias).toMatch(/^[\p{L}]+-\d{2}$/u);
    }
  });
});

describe('server secrets never appear in frontend sources', () => {
  it('does not reference the service role or Anthropic keys', () => {
    const frontendDir = resolve(root, 'frontend', 'src');
    const sources = walk(frontendDir)
      .filter((file) => /\.(ts|css|html)$/.test(file))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(sources).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(sources).not.toContain('ANTHROPIC_API_KEY');
  });
});
