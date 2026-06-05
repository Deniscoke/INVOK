import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../');
const envExample = readFileSync(resolve(root, '.env.example'), 'utf8');

describe('.env.example', () => {
  it('documents all required public + server variables', () => {
    const keys = [
      'VITE_APP_ENV',
      'VITE_PUBLIC_BASE_URL',
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY',
      'OPENAI_VALIDATION_MODEL',
      'OPENAI_VALIDATION_PROVIDER',
      'MAX_UPLOAD_MB',
      'RATE_LIMIT_WINDOW_MS',
      'RATE_LIMIT_MAX',
    ];
    for (const key of keys) {
      expect(envExample).toContain(key);
    }
  });

  it('ships secret placeholders empty (no real values committed)', () => {
    expect(envExample).toMatch(/^SUPABASE_SERVICE_ROLE_KEY=\s*$/m);
    expect(envExample).toMatch(/^OPENAI_API_KEY=\s*$/m);
    expect(envExample).toMatch(/^VITE_SUPABASE_ANON_KEY=\s*$/m);
  });
});
