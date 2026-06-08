/**
 * Bundling probe: a trivial module placed under api/_lib to test whether
 * @vercel/node bundles files under api/ (it should). If api/health.ts can
 * statically import this helper and stay healthy, the same will apply for
 * the full move of backend/{lib,services} into api/_lib.
 */
export function envProbeOk(): { ok: boolean; bundledAs: string } {
  return { ok: true, bundledAs: 'api/_lib/_env_probe' };
}
