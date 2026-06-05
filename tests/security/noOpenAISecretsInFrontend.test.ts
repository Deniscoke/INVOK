import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
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

describe('OpenAI secrets never reach the frontend', () => {
  it('does not reference OPENAI_API_KEY', () => {
    expect(frontendSources).not.toContain('OPENAI_API_KEY');
  });

  it('does not import the server-only OpenAI client or SDK', () => {
    expect(frontendSources).not.toMatch(/import[^\n]*openaiClient/i);
    expect(frontendSources).not.toContain("from 'openai'");
  });

  it('does not reference the service role key', () => {
    expect(frontendSources).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});

describe('Anthropic has been fully removed', () => {
  it('anthropicClient.ts no longer exists', () => {
    expect(existsSync(resolve(root, 'backend', 'lib', 'anthropicClient.ts'))).toBe(false);
  });

  it('.env.example contains no Anthropic variables', () => {
    const env = readFileSync(resolve(root, '.env.example'), 'utf8');
    expect(env).not.toMatch(/anthropic/i);
    expect(env).toContain('OPENAI_API_KEY');
  });

  it('AI docs no longer reference Anthropic/Claude as the provider', () => {
    for (const doc of ['docs/AI_VALIDATION.md', 'docs/SECURITY.md', 'README.md']) {
      const text = readFileSync(resolve(root, doc), 'utf8');
      expect(text).not.toMatch(/anthropic/i);
    }
  });

  it('package.json depends on openai, not @anthropic-ai/sdk', () => {
    const pkg = readFileSync(resolve(root, 'package.json'), 'utf8');
    expect(pkg).toContain('"openai"');
    expect(pkg).not.toContain('@anthropic-ai/sdk');
  });
});
