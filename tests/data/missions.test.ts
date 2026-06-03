import { describe, it, expect } from 'vitest';
import missions from '../../data/missions.json';
import competencies from '../../data/competencies.json';

const DIFFICULTY = ['easy', 'medium', 'hard'];
const MODE = ['individual', 'team'];

describe('missions catalog', () => {
  const items = missions as unknown as any[];
  const competencyIds = new Set((competencies as unknown as any[]).map((c) => c.id));

  it('has at least 7 missions', () => {
    expect(items.length).toBeGreaterThanOrEqual(7);
  });

  it('each mission has rubric, target competencies and valid metadata', () => {
    for (const m of items) {
      expect(typeof m.id).toBe('string');
      expect(typeof m.title).toBe('string');
      expect(typeof m.goal).toBe('string');
      expect(typeof m.evidenceRequired).toBe('object');
      expect(Array.isArray(m.evidenceRequired.acceptedTypes)).toBe(true);

      expect(Array.isArray(m.targetCompetencies)).toBe(true);
      expect(m.targetCompetencies.length).toBeGreaterThan(0);

      expect(Array.isArray(m.rubric)).toBe(true);
      expect(m.rubric.length).toBeGreaterThan(0);
      for (const criterion of m.rubric) {
        expect(typeof criterion.id).toBe('string');
        expect(typeof criterion.label).toBe('string');
        expect(typeof criterion.description).toBe('string');
      }

      expect(typeof m.baseXp).toBe('number');
      expect(m.baseXp).toBeGreaterThan(0);
      expect(DIFFICULTY).toContain(m.difficulty);
      expect(MODE).toContain(m.suggestedMode);
    }
  });

  it('every target competency references an existing competency', () => {
    for (const m of items) {
      for (const id of m.targetCompetencies) {
        expect(competencyIds.has(id)).toBe(true);
      }
    }
  });
});
