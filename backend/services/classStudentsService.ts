/**
 * Per-student overview for a teacher (SERVER-ONLY).
 *
 * Returns, for each pseudonymous student in the teacher's class(es), an
 * aggregated snapshot: total XP, competency strengths, questionnaire input/output
 * totals, completed Akadémia lessons and project-challenge counts. Pseudonymous
 * (only the alias, never personal data). Bulk queries keep it to a few round-trips.
 */
import { getServerEnv, missingServerSecrets } from '../lib/env.js';
import type { RequestContext } from '../lib/requestContext.js';
import { levelForXp } from './progressService.js';

export interface ClassStudent {
  accessCodeId: string;
  pseudonym: string;
  totalXp: number;
  level: number;
  competencies: { competencyId: string; mastery: number }[];
  questionnaireInput: number | null;
  questionnaireOutput: number | null;
  academyDone: number;
  questsTotal: number;
  questsCompleted: number;
}

function isConfigured(): boolean {
  return missingServerSecrets(getServerEnv()).length === 0;
}

interface Acc {
  pseudonym: string;
  xp: number;
  comp: Record<string, { xp: number; mastery: number }>;
  qIn: number | null;
  qOut: number | null;
  academy: number;
  questsTotal: number;
  questsCompleted: number;
}

function detectedFrom(evalField: unknown): Array<{ id: string; strength: number }> {
  const ev = Array.isArray(evalField) ? evalField[0] : evalField;
  const detected = (ev as Record<string, unknown> | undefined)?.detected_competencies;
  return Array.isArray(detected) ? (detected as Array<{ id: string; strength: number }>) : [];
}

export async function getClassStudents(
  ctx: RequestContext,
  classId?: string,
): Promise<{ ok: boolean; students?: ClassStudent[]; error?: string; status?: number }> {
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
    if (classIds.length === 0) return { ok: true, students: [] };

    const { data: codes } = await admin
      .from('student_access_codes')
      .select('id, pseudonym')
      .in('class_id', classIds);
    const accessCodes = (codes ?? []) as Array<{ id: string; pseudonym: string }>;
    if (accessCodes.length === 0) return { ok: true, students: [] };
    const ids = accessCodes.map((c) => c.id);

    const [subs, ques, acad, quests] = await Promise.all([
      admin.from('submissions').select('student_access_code_id, xp_awarded, ai_evaluations(detected_competencies)').in('student_access_code_id', ids),
      admin.from('questionnaire_responses').select('student_access_code_id, phase, total_score, xp_awarded').in('student_access_code_id', ids),
      admin.from('academy_progress').select('student_access_code_id, xp_awarded').in('student_access_code_id', ids),
      admin.from('student_quests').select('student_access_code_id, state').in('student_access_code_id', ids),
    ]);

    const map = new Map<string, Acc>();
    for (const c of accessCodes) {
      map.set(c.id, { pseudonym: c.pseudonym, xp: 0, comp: {}, qIn: null, qOut: null, academy: 0, questsTotal: 0, questsCompleted: 0 });
    }

    for (const r of (subs.data ?? []) as Record<string, unknown>[]) {
      const acc = map.get(String(r.student_access_code_id));
      if (!acc) continue;
      const xp = Number(r.xp_awarded ?? 0);
      acc.xp += xp;
      const detected = detectedFrom(r.ai_evaluations);
      if (xp > 0 && detected.length > 0) {
        const share = xp / detected.length;
        for (const d of detected) {
          const cur = acc.comp[d.id] ?? { xp: 0, mastery: 0 };
          cur.xp += share;
          cur.mastery = Math.max(cur.mastery, Number(d.strength ?? 0));
          acc.comp[d.id] = cur;
        }
      }
    }
    for (const r of (ques.data ?? []) as Record<string, unknown>[]) {
      const acc = map.get(String(r.student_access_code_id));
      if (!acc) continue;
      acc.xp += Number(r.xp_awarded ?? 0);
      if (r.phase === 'input') acc.qIn = Number(r.total_score ?? 0);
      else if (r.phase === 'output') acc.qOut = Number(r.total_score ?? 0);
    }
    for (const r of (acad.data ?? []) as Record<string, unknown>[]) {
      const acc = map.get(String(r.student_access_code_id));
      if (!acc) continue;
      acc.xp += Number(r.xp_awarded ?? 0);
      acc.academy += 1;
    }
    for (const r of (quests.data ?? []) as Record<string, unknown>[]) {
      const acc = map.get(String(r.student_access_code_id));
      if (!acc) continue;
      if (r.state !== 'draft' && r.state !== 'rejected') {
        acc.questsTotal += 1;
        if (r.state === 'completed') acc.questsCompleted += 1;
      }
    }

    const students: ClassStudent[] = accessCodes
      .map((c) => {
        const a = map.get(c.id) as Acc;
        return {
          accessCodeId: c.id,
          pseudonym: a.pseudonym,
          totalXp: a.xp,
          level: levelForXp(a.xp),
          competencies: Object.entries(a.comp).map(([competencyId, v]) => ({
            competencyId,
            mastery: Math.round(v.mastery * 100) / 100,
          })),
          questionnaireInput: a.qIn,
          questionnaireOutput: a.qOut,
          academyDone: a.academy,
          questsTotal: a.questsTotal,
          questsCompleted: a.questsCompleted,
        };
      })
      .sort((x, y) => x.pseudonym.localeCompare(y.pseudonym, 'sk'));

    return { ok: true, students };
  } catch {
    return { ok: false, error: 'Načítanie žiakov zlyhalo.', status: 500 };
  }
}
