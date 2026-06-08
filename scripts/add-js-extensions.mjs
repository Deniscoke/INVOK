// One-shot migration: add explicit `.js` extension to every relative TS
// import in api/ and backend/. ESM Node 22 (used by @vercel/node@3) strictly
// requires file extensions on relative specifiers, otherwise the function
// crashes at load time with ERR_MODULE_NOT_FOUND (and FUNCTION_INVOCATION_FAILED).
//
// What we touch:
//   - `import { x } from '../foo'`       → `'../foo.js'`
//   - `import { x } from './bar/baz'`    → `'./bar/baz.js'`
//   - `import type { Y } from '../q'`    → `'../q.js'`
//   - `export { z } from './r'`          → `'./r.js'`
//
// What we DO NOT touch:
//   - npm package imports (no leading `./` or `../`)
//   - imports that already have an extension (.js, .json, .ts, .css, …)
//   - import.meta usage
//   - declaration files (.d.ts)
import { readFileSync, writeFileSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOTS = ['api', 'backend'];
const repoRoot = path.resolve(process.cwd());

const importRe =
  /(\b(?:import|export)\b(?:\s+type)?\s+(?:[\s\S]*?)\s+from\s+|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]+?)\2/g;

const hasExt = (spec) => /\.[a-z0-9]+$/i.test(spec);

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(p, out);
    } else if (e.isFile() && /\.(ts|tsx|js|mjs)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      out.push(p);
    }
  }
  return out;
}

function transform(src) {
  let changed = false;
  const next = src.replace(importRe, (full, prefix, quote, spec) => {
    if (hasExt(spec)) return full;
    changed = true;
    return `${prefix}${quote}${spec}.js${quote}`;
  });
  return { next, changed };
}

const targets = (await Promise.all(ROOTS.map((r) => walk(path.join(repoRoot, r))))).flat();
let touched = 0;
for (const file of targets) {
  const src = readFileSync(file, 'utf8');
  const { next, changed } = transform(src);
  if (changed) {
    writeFileSync(file, next, 'utf8');
    touched += 1;
    console.log('updated', path.relative(repoRoot, file));
  }
}
console.log(`\nDone. ${touched} files updated.`);
