import { describe, it, expect } from 'vitest';
import competencies from '../../data/competencies.json';

const REQUIRED_IDS = [
  'fact_detective',
  'maker_venture',
  'team_builder',
  'digital_navigator',
  'community_hero',
  'resource_guardian',
  'planet_guardian',
  'self_captain',
];

describe('competencies catalog', () => {
  const items = competencies as unknown as any[];

  it('has at least 8 competencies', () => {
    expect(items.length).toBeGreaterThanOrEqual(8);
  });

  it('contains all required playful competency ids', () => {
    const ids = items.map((c) => c.id);
    for (const id of REQUIRED_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('each competency has all required fields', () => {
    for (const c of items) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.childName).toBe('string');
      expect(typeof c.childDescription).toBe('string');
      expect(typeof c.teacherDescription).toBe('string');
      expect(typeof c.curriculumMapping).toBe('object');
      expect(typeof c.curriculumMapping.framework).toBe('string');
      expect(typeof c.curriculumMapping.area).toBe('string');
      expect(typeof c.curriculumMapping.note).toBe('string');
      expect(Array.isArray(c.measurementExamples)).toBe(true);
      expect(c.measurementExamples.length).toBeGreaterThan(0);
      expect(typeof c.icon).toBe('string');
    }
  });
});
