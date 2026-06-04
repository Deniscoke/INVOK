import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const frontendSources = walk(resolve(root, 'frontend', 'src'))
  .filter((file) => /\.(ts|css|html)$/.test(file))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

describe('AI secrets never reach the frontend', () => {
  it('does not reference ANTHROPIC_API_KEY', () => {
    expect(frontendSources).not.toContain('ANTHROPIC_API_KEY');
  });

  it('does not import the server-only anthropic client', () => {
    expect(frontendSources).not.toMatch(/import[^\n]*anthropicClient/i);
    expect(frontendSources).not.toContain('@anthropic-ai/sdk');
  });

  it('does not reference the service role key', () => {
    expect(frontendSources).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
