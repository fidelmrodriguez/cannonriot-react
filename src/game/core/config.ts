import type { GameConfig } from '../../types/game';

export const DEFAULT_CONFIG: GameConfig = {
  sessionTime: 120,
  enemySpawnTime: 3,
  playerMaxHealth: 100,
  playerSpeed: 225,
  playerRotationSpeed: 2.9,
  enemySpeed: 105,
  shooterRange: 300,
  projectileSpeed: 520,
  projectileLifetime: 1.6,
  playerProjectileDamage: 34,
  enemyProjectileDamage: 14,
  chaserCollisionDamage: 26,
  frontCooldown: 0.38,
  broadsideCooldown: 1.1,
};

export const CONFIG_LIMITS = {
  sessionTime: { min: 60, max: 180, step: 10 },
  enemySpawnTime: { min: 1, max: 8, step: 0.5 },
} as const;

/**
 * Extra arcade mechanics layered on top of the challenge's required balance.
 * Keeping them centralized lets us tune game feel without changing system logic.
 */
export const EXTRA_BALANCE = {
  spawn: {
    enemyTypePattern: ['chaser', 'shooter'] as const,
  },
  dash: {
    baseCooldown: 2.65,
    distance: 132,
    windDistance: 158,
  },
  powderBarrel: {
    baseCooldown: 6.4,
    lifetime: 10.5,
    armTime: 0.48,
    damage: 62,
    blastRadius: 92,
    triggerRadius: 58,
    maxActive: 3,
  },
  pickups: {
    maxActive: 4,
    baseLifetime: 9.5,
    baseMedicine: 20,
    baseBuffDuration: 6.8,
  },
  weapons: {
    switchLockSeconds: 0.25,
    inputBufferSeconds: 0.32,
  },
  powerups: {
    powderFrontCooldownMultiplier: 0.62,
    powderFrontDamageMultiplier: 1.15,
    powderBroadsideDamageMultiplier: 1.12,
    powderProjectileSpeedMultiplier: 1.3,
    windSpeedMultiplier: 1.2,
    armorDamageMultiplier: 0.64,
  },
  adaptive: {
    referenceSessionTime: 120,
    referenceSpawnTime: 3,
    minPressure: 0.7,
    maxPressure: 2.6,
    minEnemyCap: 9,
    maxEnemyCap: 17,
    buffExtensionMultiplier: 0.55,
    maxBuffDurationMultiplier: 1.65,
  },
  ai: {
    separationPadding: 48,
    stuckRecoverySeconds: 0.32,
    lookAheadDistance: 82,
  },
} as const;
