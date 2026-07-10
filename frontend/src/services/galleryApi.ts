/**
 * Databáza školských projektov — frontend client.
 * Students browse (session token); teachers curate (Supabase JWT).
 */
import { supabase } from './supabaseClient';

const STUDENT_TOKEN_KEY = 'invok_student_session';

export interface GalleryProject {
  questId: string;
  title: string;
  goal: string | null;
  affectedGroup: string | null;
  pseudonym: string;
  className: string;
  grade: number | null;
  schoolName: string;
  region: string | null;
  publishedAt: string;
}

export type CurationProject = GalleryProject & { published: boolean };

function studentToken(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(STUDENT_TOKEN_KEY) : null;
}

async function teacherHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    if (t) headers.authorization = `Bearer ${t}`;
  }
  return headers;
}

/** Student: browse the published gallery. */
export async function fetchGallery(): Promise<GalleryProject[]> {
  const t = studentToken();
  if (!t) return [];
  try {
    const res = await fetch('/api/student/gallery', { headers: { authorization: `Bearer ${t}` } });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; projects?: GalleryProject[] } | null;
    return res.ok && data?.ok && Array.isArray(data.projects) ? data.projects : [];
  } catch {
    return [];
  }
}

/** Teacher: completed quests of their class(es) with publish state. */
export async function fetchCurationList(classId?: string): Promise<CurationProject[]> {
  try {
    const qs = classId ? `?classId=${encodeURIComponent(classId)}` : '';
    const res = await fetch(`/api/teacher/gallery${qs}`, { headers: await teacherHeaders() });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; projects?: CurationProject[] } | null;
    return res.ok && data?.ok && Array.isArray(data.projects) ? data.projects : [];
  } catch {
    return [];
  }
}

/** Teacher: publish/unpublish a completed project. */
export async function setProjectPublished(questId: string, publish: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/teacher/gallery', {
      method: 'POST',
      headers: await teacherHeaders(),
      body: JSON.stringify({ questId, publish }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error ?? 'Úprava galérie zlyhala.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Spojenie so serverom zlyhalo.' };
  }
}
