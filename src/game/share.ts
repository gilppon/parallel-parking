import { LEVELS } from './levels';
import type { ResultPayload } from './types';

export interface ParkingChallenge {
  levelIndex: number;
  stars: number;
  perfect: boolean;
  angleErrDeg: number;
  overflowCm: number;
}

function getParam(name: string): string | null {
  const sdk = window.PokiSDK as unknown as { getURLParam?: (key: string) => string | null } | undefined;
  const params = new URLSearchParams(window.location.search);
  return sdk?.getURLParam?.(name) || params.get(name) || params.get(`gd${name}`);
}

export function readParkingChallenge(): ParkingChallenge | null {
  if (getParam('type') !== 'parking_challenge') return null;
  const levelIndex = Number(getParam('level'));
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= LEVELS.length) return null;
  const numeric = (name: string) => {
    const value = Number(getParam(name));
    return Number.isFinite(value) ? value : 0;
  };
  return {
    levelIndex,
    stars: numeric('stars'),
    perfect: getParam('perfect') === '1',
    angleErrDeg: numeric('angle'),
    overflowCm: numeric('clearance'),
  };
}

export async function createParkingShareUrl(result: ResultPayload): Promise<string> {
  const params = {
    type: 'parking_challenge',
    level: String(result.levelIndex),
    stars: String(result.stars),
    perfect: result.perfect ? '1' : '0',
    angle: Math.abs(result.angleErrDeg).toFixed(1),
    clearance: result.overflowCm.toFixed(1),
  };
  const sdk = window.PokiSDK as unknown as { shareableURL?: (values: Record<string, string>) => Promise<string> } | undefined;
  try {
    const pokiUrl = await sdk?.shareableURL?.(params);
    if (pokiUrl) return pokiUrl;
  } catch {
    // Use a regular query URL outside Poki or when URL generation is unavailable.
  }
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}
