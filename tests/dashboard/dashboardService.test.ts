import { describe, it, expect } from 'vitest';
import {
  summarize,
  competencyBreakdown,
  problemProposalBreakdown,
  reviewBreakdown,
  type DashboardRecord,
} from '../../backend/services/dashboardService';

function rec(over: Partial<DashboardRecord>): DashboardRecord {
  return {
    classId: 'c1',
    missionId: 'A',
    status: 'ai_reviewed',
    submissionKind: 'solution_submission',
    xpAwarded: 0,
    problemQualityScore: null,
    problemRewardXp: 0,
    aiScore: 80,
    suggestedTeacherReview: false,
    reviewed: false,
    decision: null,
    finalScore: null,
    ...over,
  };
}

const records: DashboardRecord[] = [
  rec({ missionId: 'A', reviewed: true, decision: 'approved', aiScore: 80, finalScore: 90, xpAwarded: 72 }),
  rec({ missionId: 'B', reviewed: false, suggestedTeacherReview: true, aiScore: 50 }),
  rec({ missionId: 'A', submissionKind: 'problem_proposal', reviewed: true, decision: 'adjusted', problemQualityScore: 70, problemRewardXp: 20, aiScore: 70, finalScore: 75, xpAwarded: 25 }),
  rec({ missionId: 'A', reviewed: true, decision: 'needs_revision', aiScore: 60, finalScore: 0, xpAwarded: 0 }),
];

describe('summarize (KPIs)', () => {
  const s = summarize(records, { studentsCount: 24, classesCount: 2 });
  it('counts submissions, reviews, pending and proposals', () => {
    expect(s.submissionsCount).toBe(4);
    expect(s.reviewedCount).toBe(3);
    expect(s.pendingReviewCount).toBe(1);
    expect(s.problemProposalsCount).toBe(1);
    expect(s.missionsCount).toBe(2);
  });
  it('totals only committed (approved/adjusted) final XP', () => {
    expect(s.totalFinalXp).toBe(72 + 25);
  });
  it('passes scope meta through', () => {
    expect(s.studentsCount).toBe(24);
    expect(s.classesCount).toBe(2);
  });
});

describe('competencyBreakdown', () => {
  const missionMap = { A: ['fact_detective', 'community_hero'], B: ['maker_venture'] };
  const competencies = [
    { id: 'fact_detective', childName: 'Detektív faktov' },
    { id: 'maker_venture', childName: 'Tvorca riešení' },
  ];
  const out = competencyBreakdown(records, missionMap, competencies);
  it('aggregates submissions/reviewed/avgProgress per competency', () => {
    const fd = out.find((c) => c.id === 'fact_detective');
    expect(fd?.submissionsCount).toBe(3);
    expect(fd?.reviewedCount).toBe(3);
    expect(fd?.avgProgress).toBe(55); // avg(90,75,0)
    const mv = out.find((c) => c.id === 'maker_venture');
    expect(mv?.submissionsCount).toBe(1);
    expect(mv?.avgProgress).toBe(50); // aiScore fallback
  });
});

describe('problemProposalBreakdown', () => {
  const p = problemProposalBreakdown(records);
  it('summarizes proposals', () => {
    expect(p.count).toBe(1);
    expect(p.avgProblemQualityScore).toBe(70);
    expect(p.avgProvisionalXp).toBe(20);
    expect(p.avgFinalXp).toBe(25);
    expect(p.needsTeacherReview).toBe(0);
  });
});

describe('reviewBreakdown (AI vs teacher delta)', () => {
  const r = reviewBreakdown(records);
  it('counts decisions and computes the score delta', () => {
    expect(r.approved).toBe(1);
    expect(r.adjusted).toBe(1);
    expect(r.needsRevision).toBe(1);
    expect(r.rejected).toBe(0);
    expect(r.avgAiScore).toBe(70); // avg(80,70,60)
    expect(r.avgTeacherScore).toBe(55); // avg(90,75,0)
    expect(r.avgScoreDelta).toBe(-15);
  });
});
