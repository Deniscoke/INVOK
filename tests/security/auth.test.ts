import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../');
const read = (rel: string): string => readFileSync(resolve(root, rel), 'utf8');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

describe('frontend auth stays client-safe', () => {
  const authService = read('frontend/src/services/authService.ts');
  const supabaseClient = read('frontend/src/services/supabaseClient.ts');

  it('authService never imports the server-only admin client', () => {
    // No import statement pulling in the server-only admin/service-role client.
    expect(authService).not.toMatch(/import[^\n]*supabaseAdmin/i);
    expect(authService).not.toContain('SERVICE_ROLE');
    expect(authService).not.toContain('../../backend');
  });

  it('supabaseClient uses only public anon credentials', () => {
    expect(supabaseClient).toContain('VITE_SUPABASE_URL');
    expect(supabaseClient).toContain('VITE_SUPABASE_ANON_KEY');
    expect(supabaseClient).not.toContain('SERVICE_ROLE');
  });

  it('roles are exactly admin / teacher / student', () => {
    expect(authService).toContain("'admin'");
    expect(authService).toContain("'teacher'");
    expect(authService).toContain("'student'");
  });

  it('no frontend source references the service role key', () => {
    const sources = walk(resolve(root, 'frontend', 'src'))
      .filter((file) => /\.(ts|css|html)$/.test(file))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(sources).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
