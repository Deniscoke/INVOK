/**
 * Validation for pilot setup (schools, classes, teachers, student codes).
 * Rejects HTML/script payloads; caps sizes; never builds SQL strings.
 */
import { containsDangerousHtml } from './submissionValidator';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9-]{1,80}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PREFIX_RE = /^[\p{L}\p{N} ._-]{2,40}$/u;

export const PILOT_LIMITS = {
  nameMax: 120,
  codesMax: 40,
} as const;

export interface ValidationIssue {
  field: string;
  message: string;
}
export type Validated<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

function obj(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
}

function name(value: unknown, field: string, issues: ValidationIssue[]): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({ field, message: `${field} je povinný.` });
    return undefined;
  }
  if (value.length > PILOT_LIMITS.nameMax) issues.push({ field, message: `${field} je príliš dlhý (max ${PILOT_LIMITS.nameMax}).` });
  if (containsDangerousHtml(value)) issues.push({ field, message: `${field} obsahuje zakázané HTML.` });
  return value.trim();
}

export interface SchoolInput { name: string; slug?: string; region?: string }
export function validateSchoolInput(raw: unknown): Validated<SchoolInput> {
  const issues: ValidationIssue[] = [];
  const body = obj(raw);
  const schoolName = name(body.schoolName ?? body.name, 'schoolName', issues);
  let slug: string | undefined;
  if (body.schoolSlug !== undefined) {
    if (typeof body.schoolSlug !== 'string' || !SLUG_RE.test(body.schoolSlug)) issues.push({ field: 'schoolSlug', message: 'schoolSlug má nepovolený formát (a-z, 0-9, -).' });
    else slug = body.schoolSlug;
  }
  const region = typeof body.region === 'string' && body.region.length <= PILOT_LIMITS.nameMax && !containsDangerousHtml(body.region) ? body.region.trim() : undefined;
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { name: schoolName as string, slug, region } };
}

export interface ClassInput { schoolId: string; name: string; grade?: number }
export function validateClassInput(raw: unknown): Validated<ClassInput> {
  const issues: ValidationIssue[] = [];
  const body = obj(raw);
  if (typeof body.schoolId !== 'string' || !UUID_RE.test(body.schoolId)) issues.push({ field: 'schoolId', message: 'schoolId musí byť UUID.' });
  const className = name(body.className ?? body.name, 'className', issues);
  let grade: number | undefined;
  if (body.grade !== undefined) {
    const g = Number(body.grade);
    if (!Number.isInteger(g) || g < 1 || g > 9) issues.push({ field: 'grade', message: 'grade musí byť 1–9.' });
    else grade = g;
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { schoolId: body.schoolId as string, name: className as string, grade } };
}

export interface TeacherInput { schoolId: string; teacherEmail: string; teacherUserId?: string }
export function validateTeacherInput(raw: unknown): Validated<TeacherInput> {
  const issues: ValidationIssue[] = [];
  const body = obj(raw);
  if (typeof body.schoolId !== 'string' || !UUID_RE.test(body.schoolId)) issues.push({ field: 'schoolId', message: 'schoolId musí byť UUID.' });
  if (typeof body.teacherEmail !== 'string' || !EMAIL_RE.test(body.teacherEmail)) issues.push({ field: 'teacherEmail', message: 'teacherEmail musí byť platný e-mail.' });
  let teacherUserId: string | undefined;
  if (body.teacherUserId !== undefined) {
    if (typeof body.teacherUserId !== 'string' || !UUID_RE.test(body.teacherUserId)) issues.push({ field: 'teacherUserId', message: 'teacherUserId musí byť UUID.' });
    else teacherUserId = body.teacherUserId;
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { schoolId: body.schoolId as string, teacherEmail: (body.teacherEmail as string).trim(), teacherUserId } };
}

export interface StudentCodesInput { classId: string; count: number; pseudonymPrefix: string }
export function validateStudentCodesInput(raw: unknown): Validated<StudentCodesInput> {
  const issues: ValidationIssue[] = [];
  const body = obj(raw);
  if (typeof body.classId !== 'string' || !UUID_RE.test(body.classId)) issues.push({ field: 'classId', message: 'classId musí byť UUID.' });
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > PILOT_LIMITS.codesMax) issues.push({ field: 'count', message: `count musí byť 1–${PILOT_LIMITS.codesMax}.` });
  const prefix = body.pseudonymPrefix;
  if (typeof prefix !== 'string' || prefix.includes('@') || !PREFIX_RE.test(prefix.trim())) {
    issues.push({ field: 'pseudonymPrefix', message: 'pseudonymPrefix má 2–40 znakov (písmená, čísla, . _ -), bez e-mailu.' });
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { classId: body.classId as string, count, pseudonymPrefix: (prefix as string).trim() } };
}
