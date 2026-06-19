import { describe, it, expect } from 'vitest';
import { supportsTemperature } from '../../backend/services/questGeneratorService';

/**
 * GPT-5.x and o-series reject a custom `temperature` on chat.completions
 * (400 Unsupported value) — which silently fell back to mock. Lock the gate so
 * we only attach temperature for models that accept it.
 */
describe('supportsTemperature', () => {
  it('allows temperature for 4o / 4.1 family', () => {
    expect(supportsTemperature('gpt-4.1-mini')).toBe(true);
    expect(supportsTemperature('gpt-4o-mini')).toBe(true);
    expect(supportsTemperature('gpt-4o')).toBe(true);
  });

  it('omits temperature for gpt-5.x and o-series reasoning models', () => {
    expect(supportsTemperature('gpt-5.5')).toBe(false);
    expect(supportsTemperature('gpt-5-mini')).toBe(false);
    expect(supportsTemperature('gpt-5.4-mini')).toBe(false);
    expect(supportsTemperature('o3-mini')).toBe(false);
    expect(supportsTemperature('o4-mini')).toBe(false);
  });
});
