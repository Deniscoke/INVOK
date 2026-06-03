/**
 * Input validation for AI submission requests.
 *
 * Runs before any AI/database work. Rejects malformed or abusive input and
 * never trusts the shape of the incoming JSON body.
 */

export const ALLOWED_EVIDENCE_TYPES = ['text', 'link', 'image', 'file'] as const;
export type EvidenceType = (typeof ALLOWED_EVIDENCE_TYPES)[number];

export const SUBMISSION_LIMITS = {
  missionIdMax: 80,
  responseMin: 10,
  responseMax: 5_000,
  evidenceMax: 5_000,
} as const;

export interface SubmissionInput {
  missionId: string;
  studentResponse: string;
  evidenceText: string;
  evidenceType: EvidenceType;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export type SubmissionValidationResult =
  | { ok: true; value: SubmissionInput }
  | { ok: false; issues: ValidationIssue[] };

function isEvidenceType(value: unknown): value is EvidenceType {
  return typeof value === 'string' && (ALLOWED_EVIDENCE_TYPES as readonly string[]).includes(value);
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
    issues.push({ field: 'studentResponse', message: `studentResponse je príliš krátky (min ${SUBMISSION_LIMITS.responseMin} znakov).` });
  } else if (studentResponse.length > SUBMISSION_LIMITS.responseMax) {
    issues.push({ field: 'studentResponse', message: `studentResponse je príliš dlhý (max ${SUBMISSION_LIMITS.responseMax} znakov).` });
  }

  const evidenceText = body.evidenceText ?? '';
  if (typeof evidenceText !== 'string') {
    issues.push({ field: 'evidenceText', message: 'evidenceText musí byť reťazec.' });
  } else if (evidenceText.length > SUBMISSION_LIMITS.evidenceMax) {
    issues.push({ field: 'evidenceText', message: `evidenceText je príliš dlhý (max ${SUBMISSION_LIMITS.evidenceMax} znakov).` });
  }

  if (!isEvidenceType(body.evidenceType)) {
    issues.push({
      field: 'evidenceType',
      message: `evidenceType musí byť jeden z: ${ALLOWED_EVIDENCE_TYPES.join(', ')}.`,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      missionId: (missionId as string).trim(),
      studentResponse: studentResponse as string,
      evidenceText: evidenceText as string,
      evidenceType: body.evidenceType as EvidenceType,
    },
  };
}
