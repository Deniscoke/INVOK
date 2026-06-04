/**
 * Frontend mission API client.
 * Fetches published missions from /api/missions with a mock fallback.
 */
import type { Mission } from './mockDataService';
import { getMissions } from './mockDataService';

export type MissionSource = 'api' | 'mock';

export interface MissionApiResult {
  missions: Mission[];
  source: MissionSource;
}

export async function fetchMissions(): Promise<MissionApiResult> {
  try {
    const response = await fetch('/api/missions');
    if (!response.ok) throw new Error('API error');
    const data = (await response.json()) as { missions: Mission[]; source?: string };
    return { missions: data.missions ?? [], source: 'api' };
  } catch {
    return { missions: getMissions(), source: 'mock' };
  }
}
