/**
 * Quest attachment uploads (frontend).
 *
 * Students upload project documentation (photos, PDF, slides, video, docs…)
 * straight to Supabase Storage via a server-issued signed URL — the file never
 * passes through a serverless function, so big files / videos are fine.
 */
import { supabase } from './supabaseClient';

const STUDENT_TOKEN_KEY = 'invok_student_session';
export const ATTACH_MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
export const ATTACH_MAX_FILES = 8;

export interface UploadedAttachment {
  name: string;
  type: string;
  sizeBytes: number;
  path: string;
}

export interface TeacherFile {
  name: string;
  url: string;
  sizeBytes: number;
}

function studentToken(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(STUDENT_TOKEN_KEY) : null;
}

/** Upload one file for a quest: ask the server for a signed URL, then upload. */
export async function uploadQuestFile(studentQuestId: string, file: File): Promise<UploadedAttachment> {
  const token = studentToken();
  // Distinct, actionable reasons (a generic message hides why media "won't go").
  if (!token) {
    throw new Error('Nie si prihlásený ako žiak. Pripoj sa kódom triedy od učiteľa a skús to znova.');
  }
  if (!supabase) {
    throw new Error('Nahrávanie súborov teraz nie je dostupné (chýba pripojenie k úložisku).');
  }
  if (file.size > ATTACH_MAX_FILE_BYTES) throw new Error(`Súbor „${file.name}" je príliš veľký (max 50 MB).`);

  const res = await fetch('/api/student/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      studentQuestId,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  });
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; bucket?: string; path?: string; token?: string; error?: string }
    | null;
  // An expired/invalid student session is the most common cause — and unlike a
  // text submit (which silently falls back to a demo scorer), a media upload has
  // no fallback, so make the real reason explicit and actionable.
  if (res.status === 401) {
    throw new Error('Tvoja relácia žiaka vypršala. Odhlás sa a znova sa pripoj kódom triedy od učiteľa, potom skús nahrať súbor.');
  }
  if (!res.ok || !data?.ok || !data.bucket || !data.path || !data.token) {
    throw new Error(data?.error ?? `Súbor „${file.name}" sa nepodarilo pripraviť na nahranie.`);
  }

  const { error } = await supabase.storage
    .from(data.bucket)
    .uploadToSignedUrl(data.path, data.token, file, { contentType: file.type || undefined });
  if (error) {
    // Surface the real Storage reason instead of swallowing it.
    const reason = error.message ? ` (${error.message})` : '';
    throw new Error(`Súbor „${file.name}" sa nepodarilo nahrať${reason}.`);
  }

  return { name: file.name, type: file.type || 'application/octet-stream', sizeBytes: file.size, path: data.path };
}

async function teacherHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    if (t) headers.authorization = `Bearer ${t}`;
  }
  return headers;
}

/** Student: list their own quest's uploaded files (history) with download URLs. */
export async function listMyQuestFiles(questId: string): Promise<TeacherFile[]> {
  const token = studentToken();
  if (!token) return [];
  try {
    const res = await fetch(`/api/student/quests?action=files&questId=${encodeURIComponent(questId)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; files?: TeacherFile[] } | null;
    return res.ok && data?.ok && Array.isArray(data.files) ? data.files : [];
  } catch {
    return [];
  }
}

/** Teacher: list a quest's uploaded files with fresh signed download URLs. */
export async function listQuestFilesForTeacher(questId: string): Promise<TeacherFile[]> {
  try {
    const res = await fetch(`/api/teacher/quests?action=files&questId=${encodeURIComponent(questId)}`, {
      headers: await teacherHeaders(),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; files?: TeacherFile[] } | null;
    return res.ok && data?.ok && Array.isArray(data.files) ? data.files : [];
  } catch {
    return [];
  }
}
