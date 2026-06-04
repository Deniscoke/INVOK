/**
 * Input validation for submission and query parameters.
 *
 * Runs before any AI/database work. Rejects malformed, abusive, or
 * XSS-carrying input — never trusts the shape of the incoming body.
 */

export const ALLOWED_EVIDENCE_TYPES = ['text'] as const; // Phase 3: text only
export type EvidenceType = (typeof ALLOWED_EVIDENCE_TYPES)[number];

export const ALLOWED_STATUSES = ['submitted', 'ai_reviewed', 'teacher_reviewed', 'approved', 'needs_revision'] as const;
export type SubmissionStatus = (typeof ALLOWED_STATUSES)[number];

export const SUBMISSION_LIMITS = {
  missionIdMax: 80,
  responseMin: 20,
  responseMax: 5_000,
  evidenceMax: 5_000,
  classIdMax: 80,
} as const;

// Patterns that indicate attempted HTML/script injection.
const DANGEROUS_PATTERNS = [
  /<script[\s\S]*?>/i,
  /<\/script>/i,
  /javascript\s*:/i,
  /on\w+\s*=/i,     // onclick=, onerror= etc.
  /<iframe/i,
  /<object/i,
  /<embed/i,
];

export interface SubmissionInput {
  missionId: string;
  studentResponse: string;
  evidenceText: string;
  evidenceType: EvidenceType;
  classId?: string;
}

export interface SubmissionQueryFilter {
  classId?: string;
  missionId?: string;
  status?: SubmissionStatus;
  from?: string;
  to?: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export type SubmissionValidationResult =
  | { ok: true; value: SubmissionInput }
  | { ok: false; issues: ValidationIssue[] };

export type QueryFilterValidationResult =
  | { ok: true; value: SubmissionQueryFilter }
  | { ok: false; issues: ValidationIssue[] };

function isEvidenceType(value: unknown): value is EvidenceType {
  return typeof value === 'string' && (ALLOWED_EVIDENCE_TYPES as readonly string[]).includes(value);
}

function isDangerous(text: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(text));
}

function checkDanger(field: string, value: string, issues: ValidationIssue[]): void {
  if (isDangerous(value)) {
    issues.push({ field, message: `${field} obsahuje zakázané HTML alebo scripty.` });
  }
}

export function validateSubmissionInput(raw: unknown): SubmissionValidationResult {
  const issues: ValidationIssue[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, issues: [{ field: 'body', message: 'Telo požiadavky musí byť JSON objekt.' }] };
  }

  const body = raw as Record<string, unknown>;

  const missionId = body.missionId;
  if (typeof missionId !== 'string' || missionId.trim().length === 0) {
    issues.push({ field: 'missionId', message: 'missionId je povinný neprázdny reťazec.' });
  } else if (missionId.length > SUBMISSION_LIMITS.missionIdMax) {
    issues.push({ field: 'missionId', message: `missionId je príliš dlhý (max ${SUBMISSION_LIMITS.missionIdMax}).` });
  }

  const studentResponse = body.studentResponse;
  if (typeof studentResponse !== 'string') {
    issues.push({ field: 'studentResponse', message: 'studentResponse je povinný reťazec.' });
  } else if (studentResponse.trim().length < SUBMISSION_LIMITS.responseMin) {
    issues.push({ field: 'studentResponse', message: `Odpoveď je príliš krátka (min ${SUBMISSION_LIMITS.responseMin} znakov).` });
  } else if (studentResponse.length > SUBMISSION_LIMITS.responseMax) {
    issues.push({ field: 'studentResponse', message: `Odpoveď je príliš dlhá (max ${SUBMISSION_LIMITS.responseMax} znakov).` });
  } else {
    checkDanger('studentResponse', studentResponse, issues);
  }

  const evidenceText = typeof body.evidenceText === 'string' ? body.evidenceText : '';
  if (evidenceText.length > SUBMISSION_LIMITS.evidenceMax) {
    issues.push({ field: 'evidenceText', message: `evidenceText je príliš dlhý (max ${SUBMISSION_LIMITS.evidenceMax} znakov).` });
  } else if (evidenceText) {
    checkDanger('evidenceText', evidenceText, issues);
  }

  if (!isEvidenceType(body.evidenceType)) {
    issues.push({
      field: 'evidenceType',
      message: `evidenceType musí byť: ${ALLOWED_EVIDENCE_TYPES.join(', ')}.`,
    });
  }

  const classId = body.classId;
  if (classId !== undefined && classId !== null) {
    if (typeof classId !== 'string' || classId.length > SUBMISSION_LIMITS.classIdMax) {
      issues.push({ field: 'classId', message: 'classId musí byť reťazec (max 80 znakov).' });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      missionId: (missionId as string).trim(),
      studentResponse: studentResponse as string,
      evidenceText,
      evidenceType: body.evidenceType as EvidenceType,
      classId: typeof classId === 'string' ? classId.trim() : undefined,
    },
  };
}

/** Validate and normalise query filters for teacher submissions list. */
export function validateQueryFilter(raw: Record<string, unknown>): QueryFilterValidationResult {
  const issues: ValidationIssue[] = [];
  const value: SubmissionQueryFilter = {};

  if (raw.classId !== undefined) {
    if (typeof raw.classId !== 'string') issues.push({ field: 'classId', message: 'classId musí byť reťazec.' });
    else value.classId = raw.classId;
  }
  if (raw.missionId !== undefined) {
    if (typeof raw.missionId !== 'string') issues.push({ field: 'missionId', message: 'missionId musí byť reťazec.' });
    else value.missionId = raw.missionId;
  }
  if (raw.status !== undefined) {
    if (!(ALLOWED_STATUSES as readonly string[]).includes(raw.status as string)) {
      issues.push({ field: 'status', message: `Neplatný status. Povolené: ${ALLOWED_STATUSES.join(', ')}.` });
    } else {
      value.status = raw.status as SubmissionStatus;
    }
  }
  if (raw.from !== undefined) {
    if (typeof raw.from !== 'string' || isNaN(Date.parse(raw.from))) {
      issues.push({ field: 'from', message: 'from musí byť platný ISO dátum.' });
    } else {
      value.from = raw.from;
    }
  }
  if (raw.to !== undefined) {
    if (typeof raw.to !== 'string' || isNaN(Date.parse(raw.to))) {
      issues.push({ field: 'to', message: 'to musí byť platný ISO dátum.' });
    } else {
      value.to = raw.to;
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}
