/**
 * Databáza školských projektov — "Ako žiaci menia svoje školy" (SERVER-ONLY).
 *
 * Teacher-curated gallery of good practice: a teacher publishes a COMPLETED
 * student quest into the gallery; anyone signed in (student or teacher) can
 * browse it for inspiration. Entries are pseudonymous and text-only (title,
 * goal, affected group, pseudonym, class/school labels) — no files, no personal
 * data. Filters follow the programme document: región + ročník (grade).
 */
import { getServerEnv, missingServerSecrets } from '../lib/env.js';
import type { RequestContext } from '../lib/requestContext.js';

export interface GalleryProject {
  questId: string;
  title: string;
  goal: string | null;
  affectedGroup: string | null;
  pseudonym: string;
  moduleId: string | null;
  className: string;
  grade: number | null;
  schoolName: string;
  region: string | null;
  publishedAt: string;
}

export interface GalleryFilters {
  region?: string;
  grade?: number;
  classId?: string;
}

function isConfigured(): boolean {
  return missingServerSecrets(getServerEnv()).length === 0;
}

function mapRow(row: Record<string, unknown>): GalleryProject | null {
  const access = row.student_access_codes as Record<string, unknown> | null;
  const cls = row.classes as Record<string, unknown> | null;
  const school = (cls?.schools ?? null) as Record<string, unknown> | null;
  if (!cls || !school) return null;
  return {
    questId: String(row.id),
    title: String(row.title ?? ''),
    goal: (row.goal as string | null) ?? null,
    affectedGroup: (row.affected_group as string | null) ?? null,
    pseudonym: access ? String(access.pseudonym ?? 'žiak') : 'žiak',
    moduleId: (row.module_id as string | null) ?? null,
    className: String(cls.name ?? ''),
    grade: cls.grade != null ? Number(cls.grade) : null,
    schoolName: String(school.name ?? ''),
    region: (school.region as string | null) ?? null,
    publishedAt: String(row.gallery_published_at),
  };
}

/** Browse the gallery (pseudonymous, curated). Caller enforces auth. */
export async function listGallery(
  filters: GalleryFilters = {},
): Promise<{ ok: boolean; projects?: GalleryProject[]; error?: string; status?: number }> {
  if (!isConfigured()) return { ok: false, error: 'Backend nie je nastavený.', status: 503 };
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();
    let query = admin
      .from('student_quests')
      .select('id, title, goal, affected_group, module_id, gallery_published_at, student_access_codes(pseudonym), classes(name, grade, schools(name, region))')
      .not('gallery_published_at', 'is', null)
      .order('gallery_published_at', { ascending: false })
      .limit(60);
    if (filters.classId) query = query.eq('class_id', filters.classId);
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message, status: 500 };
    let projects = ((data ?? []) as Record<string, unknown>[])
      .map(mapRow)
      .filter((p): p is GalleryProject => p !== null);
    if (filters.region) projects = projects.filter((p) => p.region === filters.region);
    if (filters.grade != null) projects = projects.filter((p) => p.grade === filters.grade);
    return { ok: true, projects };
  } catch {
    return { ok: false, error: 'Načítanie galérie zlyhalo.', status: 500 };
  }
}

/** Teacher publishes / unpublishes a COMPLETED quest of a class they manage. */
export async function setGalleryPublished(
  ctx: RequestContext,
  questId: string,
  publish: boolean,
): Promise<{ ok: boolean; published?: boolean; error?: string; status?: number }> {
  if (ctx.mode !== 'supabase_user' || (ctx.role !== 'teacher' && ctx.role !== 'admin')) {
    return { ok: false, error: 'Iba učiteľ/admin.', status: 403 };
  }
  if (!isConfigured()) return { ok: false, error: 'Backend nie je nastavený.', status: 503 };
  if (!questId) return { ok: false, error: 'Chýba ID projektu.', status: 400 };
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();

    const { data } = await admin
      .from('student_quests')
      .select('id, class_id, state')
      .eq('id', questId)
      .maybeSingle();
    const row = data as Record<string, unknown> | null;
    if (!row) return { ok: false, error: 'Projekt sa nenašiel.', status: 404 };
    if (publish && row.state !== 'completed') {
      return { ok: false, error: 'Do galérie možno zaradiť len dokončený projekt.', status: 409 };
    }
    if (ctx.role !== 'admin') {
      const { data: membership } = await admin
        .from('class_memberships')
        .select('id')
        .eq('class_id', row.class_id as string)
        .eq('user_id', ctx.userId)
        .eq('role', 'teacher')
        .maybeSingle();
      if (!membership) return { ok: false, error: 'Túto triedu neučíš.', status: 403 };
    }

    const patch = publish
      ? { gallery_published_at: new Date().toISOString(), gallery_published_by: ctx.userId }
      : { gallery_published_at: null, gallery_published_by: null };
    const { error } = await admin.from('student_quests').update(patch).eq('id', questId);
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, published: publish };
  } catch {
    return { ok: false, error: 'Úprava galérie zlyhala.', status: 500 };
  }
}

/** Teacher: completed quests of their class(es) with publish state (curation list). */
export async function listCompletedForCuration(
  ctx: RequestContext,
  classId?: string,
): Promise<{ ok: boolean; projects?: Array<GalleryProject & { published: boolean }>; error?: string; status?: number }> {
  if (ctx.mode !== 'supabase_user' || (ctx.role !== 'teacher' && ctx.role !== 'admin')) {
    return { ok: false, error: 'Iba učiteľ/admin.', status: 403 };
  }
  if (!isConfigured()) return { ok: false, error: 'Backend nie je nastavený.', status: 503 };
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();
    const { data: memberships } = await admin
      .from('class_memberships')
      .select('class_id')
      .eq('user_id', ctx.userId)
      .eq('role', 'teacher');
    let classIds = ((memberships ?? []) as Array<{ class_id: string }>).map((m) => String(m.class_id));
    if (classId) classIds = classIds.filter((id) => id === classId);
    if (classIds.length === 0) return { ok: true, projects: [] };

    const { data, error } = await admin
      .from('student_quests')
      .select('id, title, goal, affected_group, module_id, gallery_published_at, student_access_codes(pseudonym), classes(name, grade, schools(name, region))')
      .in('class_id', classIds)
      .eq('state', 'completed')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) return { ok: false, error: error.message, status: 500 };
    const projects = ((data ?? []) as Record<string, unknown>[])
      .map((r) => {
        const published = r.gallery_published_at != null;
        const mapped = mapRow({ ...r, gallery_published_at: r.gallery_published_at ?? '' });
        return mapped ? { ...mapped, published } : null;
      })
      .filter((p): p is GalleryProject & { published: boolean } => p !== null);
    return { ok: true, projects };
  } catch {
    return { ok: false, error: 'Načítanie projektov zlyhalo.', status: 500 };
  }
}
