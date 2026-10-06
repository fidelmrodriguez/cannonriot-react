import type { Container, Graphics, Sprite } from 'pixi.js';

export interface Vec2 { x: number; y: number }
export interface CircleCollider { x: number; y: number; radius: number }
export interface Island { x: number; y: number; radius: number; view: Container; colliders: CircleCollider[] }
export type EnemyKind = 'chaser' | 'shooter';
export type PickupKind = 'medicine' | 'powder' | 'wind' | 'armor';

export interface ShipEntity {
  id: string;
  x: number;
  y: number;
  rotation: number;
  radius: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  view: Container;
  body: Container;
  sprite: Sprite;
  outline: Sprite;
  damageFx: Sprite;
  damageGlow?: Graphics;
  baseScale: number;
  healthBack: Graphics;
  healthFill: Graphics;
}

export interface EnemyEntity extends ShipEntity {
  kind: EnemyKind;
  shootCooldown: number;
  warned?: boolean;
  telegraphing?: boolean;
  targetingKraken?: boolean;
  krakenRetaliationTime: number;
  preferredOrbitSign: -1 | 1;
  orbitFlipCooldown: number;
  stuckTime: number;
  lastAiX: number;
  lastAiY: number;
}


export interface KrakenEntity {
  id: string;
  x: number;
  y: number;
  radius: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  view: Container;
  sprite: Sprite;
  healthBack: Graphics;
  healthFill: Graphics;
  wakeOuter: Graphics;
  wakeInner: Graphics;
  tentacles: Array<{
    view: Container;
    baseX: number;
    baseY: number;
    baseRotation: number;
    phase: number;
    speed: number;
    amplitude: number;
  }>;
  baseSpriteScale: number;
  swimIntensity: number;
  preferredOrbitSign: -1 | 1;
  orbitFlipCooldown: number;
  stuckTime: number;
  lastAiX: number;
  lastAiY: number;
  navPath: Vec2[];
  navPathIndex: number;
  navRepathCooldown: number;
  navTargetId: string;
  attackCooldown: number;
  attackPrepRemaining: number;
  attackX: number;
  attackY: number;
  attackPoints: Vec2[];
}

export interface ProjectileEntity {
  id: string;
  owner: 'player' | 'enemy';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  lifetime: number;
  totalLifetime: number;
  alive: boolean;
  view: Container;
  ball?: Sprite;
  shadow?: Graphics;
  glow?: Graphics;
}

export interface PickupEntity {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
  radius: number;
  lifetime: number;
  alive: boolean;
  view: Container;
}


export interface PowderBarrelEntity {
  id: string;
  x: number;
  y: number;
  radius: number;
  blastRadius: number;
  damage: number;
  lifetime: number;
  armTime: number;
  alive: boolean;
  view: Container;
}
