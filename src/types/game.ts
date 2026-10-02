export type EndReason = 'timeout' | 'destroyed';

export interface GameConfig {
  sessionTime: number;
  enemySpawnTime: number;
  playerMaxHealth: number;
  playerSpeed: number;
  playerRotationSpeed: number;
  enemySpeed: number;
  shooterRange: number;
  projectileSpeed: number;
  projectileLifetime: number;
  playerProjectileDamage: number;
  enemyProjectileDamage: number;
  chaserCollisionDamage: number;
  frontCooldown: number;
  broadsideCooldown: number;
}

export type LeaderboardConfig = Pick<GameConfig, 'sessionTime' | 'enemySpawnTime'>;

export interface MatchResult {
  matchId: string;
  playerId: string;
  playerName: string;
  playedAt: string;
  score: number;
  duration: number;
  endReason: EndReason;
  config: GameConfig;
  seed: number;
}

export interface RankingEntry extends MatchResult {
  rank: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type NetworkScenario =
  | 'normal'
  | 'empty'
  | 'pagination'
  | 'slow'
  | 'timeout'
  | 'variable-latency'
  | 'out-of-order'
  | 'network-error'
  | 'client-error'
  | 'server-error'
  | 'ranking-error'
  | 'history-error'
  | 'timeout-after-save'
  | 'unavailable-on-game-over';
