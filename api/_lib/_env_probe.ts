/**
 * Bundling probe v2: same as before but the importing file now uses an
 * explicit `.js` extension on the import specifier. ESM Node 22 requires
 * extensions on relative specifiers, which may be why the previous probe
 * (extension-less) crashed at module load time.
 */
export function envProbeOk(): { ok: boolean; bundledAs: string; mode: string } {
  return { ok: true, bundledAs: 'api/_lib/_env_probe', mode: 'js-extension' };
}
