import type { Container, Graphics, Sprite } from 'pixi.js';

export interface Vec2 { x: number; y: number }
export interface CircleCollider { x: number; y: number; radius: number }
export interface Island { x: number; y: number; radius: number; view: Container; colliders: CircleCollider[] }
export type EnemyKind = 'chaser' | 'shooter';
export type EnemyTarget = 'player' | 'kraken';
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
  preferredOrbitSign: -1 | 1;
  orbitFlipCooldown: number;
  stuckTime: number;
  lastAiX: number;
  lastAiY: number;
  targetKraken?: boolean;
}

export interface KrakenEntity extends ShipEntity {
  attackCooldown: number;
  telegraphTime: number;
  attackX: number;
  attackY: number;
  targetId: string | null;
  bornAt: number;
}

export interface ProjectileEntity {
  id: string;
  owner: 'player' | 'enemy';
  target?: EnemyTarget;
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
