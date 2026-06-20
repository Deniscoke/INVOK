/**
 * Submission attachments — Supabase Storage helpers (SERVER-ONLY).
 *
 * Students are pseudonymous, so files don't go through RLS/auth. Instead the
 * server (service role) issues a short-lived SIGNED UPLOAD URL and the browser
 * uploads straight to Storage with it — the file never passes through a Vercel
 * function (no body-size limit). Files live under `<questId>/…`, so the teacher
 * just lists that prefix; no DB column needed.
 *
 * Do NOT import from frontend code.
 */
import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from './supabaseAdmin.js';

export const ATTACH_BUCKET = 'submission-files';
export const ATTACH_MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB / file
export const ATTACH_MAX_FILES = 8;

const ALLOWED_TYPE_PREFIXES = ['image/', 'video/', 'audio/', 'text/'];
const ALLOWED_TYPES_EXACT = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream', // generic fallback (e.g. some browsers)
]);

/** Whether a MIME type is an accepted attachment kind. */
export function isAllowedAttachmentType(type: string): boolean {
  const t = (type || '').toLowerCase();
  return ALLOWED_TYPE_PREFIXES.some((p) => t.startsWith(p)) || ALLOWED_TYPES_EXACT.has(t);
}

/** Make a storage-safe, length-bounded file name (keeps the original visible). */
export function sanitizeFileName(name: string): string {
  const cleaned = (name || '')
    .replace(/[/\\]+/g, '_')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
  return cleaned || 'subor';
}

export interface SignedUpload {
  bucket: string;
  path: string;
  token: string;
}

/** Issue a one-time signed upload URL for a file under a quest's folder. */
export async function createQuestUploadUrl(questId: string, fileName: string): Promise<SignedUpload | null> {
  const admin = getSupabaseAdmin();
  const path = `${questId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
  const { data, error } = await admin.storage.from(ATTACH_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return null;
  return { bucket: ATTACH_BUCKET, path, token: data.token };
}

export interface QuestFile {
  name: string; // display name (uuid prefix stripped)
  path: string;
  url: string; // short-lived signed download URL
  sizeBytes: number;
}

/** List a quest's uploaded files with fresh signed download URLs (for teachers). */
export async function listQuestFiles(questId: string): Promise<QuestFile[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from(ATTACH_BUCKET).list(questId, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });
  if (error || !data) return [];
  const out: QuestFile[] = [];
  for (const f of data) {
    if (!f.name || f.id === null) continue; // skip folder placeholders
    const path = `${questId}/${f.name}`;
    const { data: signed } = await admin.storage.from(ATTACH_BUCKET).createSignedUrl(path, 3600);
    if (!signed) continue;
    out.push({
      name: f.name.replace(/^[0-9a-fA-F-]{36}-/, ''),
      path,
      url: signed.signedUrl,
      sizeBytes: typeof f.metadata?.size === 'number' ? f.metadata.size : 0,
    });
  }
  return out;
}
