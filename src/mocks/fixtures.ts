import { DEFAULT_CONFIG } from '../game/core/config';
import type { MatchResult } from '../types/game';

const FIXTURE_EPOCH = Date.parse('2026-01-15T12:00:00.000Z');

const names = ['MARA MARAUDER', 'SALT WIZARD', 'BOOMBEARD', 'CAPTAIN CHAOS', 'TUNA TERROR', 'POWDER POLLY', 'RED WAKE', 'KRAKEN KID', 'GULL KING', 'BARNACLE BOSS'];

export const FIXTURE_MATCHES: MatchResult[] = names.flatMap((playerName, index) => [
  {
    matchId: `fixture-${index}-120-3`,
    playerId: `fixture-${index}`,
    playerName,
    playedAt: new Date(FIXTURE_EPOCH - (index + 2) * 3_600_000).toISOString(),
    score: 28 - index * 2,
    duration: 120,
    endReason: index % 4 === 0 ? 'destroyed' : 'timeout',
    config: { ...DEFAULT_CONFIG, sessionTime: 120, enemySpawnTime: 3 },
    seed: 400 + index,
  },
  {
    matchId: `fixture-${index}-60-2`,
    playerId: `fixture-${index}`,
    playerName,
    playedAt: new Date(FIXTURE_EPOCH - (index + 1) * 7_200_000).toISOString(),
    score: 17 - index,
    duration: 60,
    endReason: 'timeout',
    config: { ...DEFAULT_CONFIG, sessionTime: 60, enemySpawnTime: 2 },
    seed: 800 + index,
  },
]);
