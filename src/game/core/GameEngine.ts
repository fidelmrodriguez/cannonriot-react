import {
  Application, Assets, BlurFilter, Container, Graphics, Sprite, Text, Texture,
} from 'pixi.js';
import type { GameConfig, EndReason, MatchResult } from '../../types/game';
import type { PlayerIdentity } from '../../storage/player.storage';
import { SeededRandom } from './SeededRandom';
import { InputManager, type GameAction } from '../input/InputManager';
import { EXTRA_BALANCE } from './config';
import { GAME_ASSETS } from '../rendering/assets';
import { getPreloadedAudioUrl } from '../../preload';
import { isSfxMuted } from '../../audio/preferences';
import type { CircleCollider, EnemyEntity, Island, PickupEntity, PickupKind, PowderBarrelEntity, ProjectileEntity, ShipEntity } from '../types/runtime';
import { engineText, gameLines, idleLineGroup } from '../../i18n';

export interface GameSnapshot {
  health: number;
  maxHealth: number;
  score: number;
  timeLeft: number;
  paused: boolean;
  streak: number;
  entityCount: number;
  enemyCount: number;
  frontReload: number;
  broadsideReload: number;
  dashReload: number;
  powderTime: number;
  windTime: number;
  armorTime: number;
  barrelReload: number;
  barrelCount: number;
}

interface EngineCallbacks {
  onSnapshot(snapshot: GameSnapshot): void;
  onEnd(result: MatchResult): void;
  onReady?(): void;
  onLoadProgress?(value: number): void;
  onLoadError?(message: string): void;
}

type ComicPanelKind = 'damage' | 'victory' | 'idle' | 'mechanic';
type MechanicReactKind = 'dash' | 'medicine' | 'powder' | 'wind' | 'armor' | 'barrel';

interface ActiveComicPanel {
  kind: ComicPanelKind;
  panel: Container;
  update: (ticker: { deltaMS: number }) => void;
}

interface IdleComicScript {
  portraitPath: string;
  lines: string[];
}

interface ComicPanelOptions {
  value?: number;
  line?: string;
  enemyKind?: 'chaser' | 'shooter';
  streak?: number;
  portraitPath?: string;
  accent?: number;
  burstFill?: number;
  headerText?: string;
  badgeText?: string;
  frameStroke?: number;
}

const WORLD_W = 1280;
const WORLD_H = 720;
const PLAYER_ID = 'local-player';
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distSq = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;
const angleWrap = (value: number) => {
  let a = value;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export class GameEngine {
  private app = new Application();
  private root = new Container();
  private world = new Container();
  private fx = new Container();
  private uiFx = new Container();
  private activeComicPanels: ActiveComicPanel[] = [];
  private lastDamagePortraitIndex = -1;
  private lastVictoryPortraitIndex = -1;
  private lastIdlePortraitIndex = -1;
  private lastIdleLine = '';
  private input = new InputManager();
  private player!: ShipEntity;
  private enemies: EnemyEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private pickups: PickupEntity[] = [];
  private powderBarrels: PowderBarrelEntity[] = [];
  private islands: Island[] = [];
  private rng: SeededRandom;
  private uiRng: SeededRandom;
  private elapsed = 0;
  private spawnClock = 0;
  private score = 0;
  private streak = 0;
  private streakClock = 0;
  private frontCooldown = 0;
  private broadsideCooldown = 0;
  private weaponSwitchCooldown = 0;
  private bufferedWeaponAction: Extract<GameAction, 'fire' | 'broadsideLeft' | 'broadsideRight'> | null = null;
  private bufferedWeaponActionTime = 0;
  private frontCooldownMax = 1;
  private broadsideCooldownMax = 1;
  private dashCooldown = 0;
  private dashCooldownMax: number = EXTRA_BALANCE.dash.baseCooldown;
  private dashWasDown = false;
  private barrelCooldown = 0;
  private barrelCooldownMax: number = EXTRA_BALANCE.powderBarrel.baseCooldown;
  private barrelWasDown = false;
  private powderTime = 0;
  private windTime = 0;
  private armorTime = 0;
  private pressure = 1;
  private maxActiveEnemies = 11;
  private visualParticleCount = 0;
  private supportClock = 0;
  private supportInterval = 16;
  private paused = false;
  private ended = false;
  private started = false;
  private lastSnapshotAt = 0;
  private audio = new Map<string, HTMLAudioElement>();
  private resizeObserver?: ResizeObserver;
  private visibilityPause = false;
  private initialized = false;
  private destroyed = false;
  private wavelets: { view: Graphics; speed: number; drift: number }[] = [];
  private wakeClock = 0;
  private spawnSequence = 0;
  private shipContactSoundCooldown = 0;
  private shipContactFxCooldown = 0;
  private timeSincePlayerDamage = 999;
  private timeSincePlayerVictory = 999;
  private timeSincePlayerOffense = 999;
  private idlePopupCooldown = 2.7;

  constructor(
    private host: HTMLElement,
    private config: GameConfig,
    private seed: number,
    private callbacks: EngineCallbacks,
    private playerIdentity: PlayerIdentity,
  ) {
    this.rng = new SeededRandom(seed);
    this.uiRng = new SeededRandom(seed ^ 0x9e3779b9);
    this.pressure = clamp((EXTRA_BALANCE.adaptive.referenceSpawnTime / Math.max(0.5, config.enemySpawnTime)) * Math.pow(config.sessionTime / EXTRA_BALANCE.adaptive.referenceSessionTime, 0.32), EXTRA_BALANCE.adaptive.minPressure, EXTRA_BALANCE.adaptive.maxPressure);
    const sessionDensity = clamp((config.sessionTime - 60) / 120, 0, 1);
    this.maxActiveEnemies = Math.round(clamp(7.2 + this.pressure * 3.45 + sessionDensity * 1.1, EXTRA_BALANCE.adaptive.minEnemyCap, EXTRA_BALANCE.adaptive.maxEnemyCap));
    this.frontCooldownMax = config.frontCooldown;
    this.broadsideCooldownMax = config.broadsideCooldown;
    this.supportInterval = clamp(16 / Math.pow(this.pressure, 0.7), 6.8, 19);
  }

  async init(): Promise<void> {
    try {
      this.callbacks.onLoadProgress?.(0.08);
      await this.app.init({
        width: WORLD_W,
        height: WORLD_H,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        backgroundAlpha: 0,
      });
      this.initialized = true;
      if (this.destroyed) { this.app.destroy(true); return; }
      this.callbacks.onLoadProgress?.(0.22);
      this.host.replaceChildren(this.app.canvas);
      this.app.stage.addChild(this.root, this.uiFx);
      this.root.addChild(this.world, this.fx);
      this.drawOcean();
      await this.loadAssets();
      if (this.destroyed) { this.app.destroy(true, { children: true }); return; }
      this.callbacks.onLoadProgress?.(0.72);
      this.createIslands();
      this.createPlayer();
      this.createArenaFrame();
      this.input.attach();
      this.app.ticker.add(this.tick);
      this.resizeObserver = new ResizeObserver(this.resize);
      this.resizeObserver.observe(this.host);
      this.resize();
      document.addEventListener('visibilitychange', this.onVisibility);
      window.addEventListener('blur', this.onBlur);
      this.started = true;
      this.emitSnapshot(true);
      this.callbacks.onLoadProgress?.(1);
      this.callbacks.onReady?.();
    } catch (error) {
      this.callbacks.onLoadError?.(error instanceof Error ? error.message : engineText('assetFail'));
      throw error;
    }
  }

  private async loadAssets(): Promise<void> {
    const urls = [
      GAME_ASSETS.player,
      GAME_ASSETS.chaser,
      GAME_ASSETS.shooter,
      GAME_ASSETS.cannonBall,
      GAME_ASSETS.explosion,
      GAME_ASSETS.fire,
      ...GAME_ASSETS.damagePortraits,
      ...GAME_ASSETS.victoryPortraits,
      ...GAME_ASSETS.idlePortraits,
      ...Object.values(GAME_ASSETS.mechanicPortraits),
    ];
    await Assets.load(urls);
    this.audio.set('front', new Audio(getPreloadedAudioUrl(GAME_ASSETS.shotSound)));
    this.audio.set('broadside', new Audio(getPreloadedAudioUrl(GAME_ASSETS.broadsideSound)));
    this.audio.set('explosion', new Audio(getPreloadedAudioUrl(GAME_ASSETS.explosionSound)));
    this.audio.set('hit1', new Audio(getPreloadedAudioUrl(GAME_ASSETS.hitSounds[0])));
    this.audio.set('hit2', new Audio(getPreloadedAudioUrl(GAME_ASSETS.hitSounds[1])));
    this.audio.set('collision', new Audio(getPreloadedAudioUrl(GAME_ASSETS.collisionSound)));
    this.audio.set('idleChirp', new Audio(getPreloadedAudioUrl(GAME_ASSETS.idleChirpSound)));
    this.audio.set('pickup', new Audio(getPreloadedAudioUrl(GAME_ASSETS.pickupSound)));
    this.audio.set('dash', new Audio(getPreloadedAudioUrl(GAME_ASSETS.dashSound)));
    this.audio.get('front')!.volume = 0.28;
    this.audio.get('broadside')!.volume = 0.30;
    this.audio.get('explosion')!.volume = 0.28;
    this.audio.get('hit1')!.volume = 0.38;
    this.audio.get('hit2')!.volume = 0.38;
    this.audio.get('collision')!.volume = 0.34;
    this.audio.get('idleChirp')!.volume = 0.20;
    this.audio.get('pickup')!.volume = 0.23;
    this.audio.get('dash')!.volume = 0.20;
  }

  private drawOcean(): void {
    const bg = new Graphics()
      .rect(0, 0, WORLD_W, WORLD_H)
      .fill({
        color: 0x0fb1cf,
        alpha: 1,
      });
    this.world.addChild(bg);

    const deepBloom = new Graphics().ellipse(WORLD_W * 0.5, WORLD_H * 0.56, 620, 360).fill({ color: 0x73ffe8, alpha: 0.14 });
    deepBloom.filters = [new BlurFilter({ strength: 28 })];
    this.world.addChild(deepBloom);

    const currentBands = new Graphics();
    for (let y = -120; y < WORLD_H + 120; y += 88) {
      const isLight = y % 176 === 0;
      currentBands
        .moveTo(-90, y)
        .bezierCurveTo(160, y - 36, 390, y + 48, 670, y - 4)
        .bezierCurveTo(930, y - 44, 1110, y + 22, WORLD_W + 120, y - 8)
        .stroke({ color: isLight ? 0x76efe8 : 0x0a8ac4, width: isLight ? 26 : 16, alpha: isLight ? 0.12 : 0.15 });
    }
    this.world.addChild(currentBands);

    const caustics = new Graphics();
    for (let i = 0; i < 18; i++) {
      const x = 80 + i * 68;
      const y = this.uiRng.range(90, WORLD_H - 90);
      caustics
        .ellipse(x, y, this.uiRng.range(55, 108), this.uiRng.range(9, 18))
        .stroke({ color: 0xcafef5, width: this.uiRng.range(2, 4), alpha: 0.1 });
    }
    caustics.rotation = -0.15;
    caustics.filters = [new BlurFilter({ strength: 2 })];
    this.world.addChild(caustics);

    const reefs = new Graphics();
    for (let i = 0; i < 11; i++) {
      reefs.ellipse(
        this.uiRng.range(70, WORLD_W - 70),
        this.uiRng.range(80, WORLD_H - 80),
        this.uiRng.range(28, 58),
        this.uiRng.range(11, 23),
      ).fill({ color: i % 2 === 0 ? 0x45d7cf : 0x2eb8b0, alpha: 0.08 });
    }
    reefs.rotation = 0.1;
    reefs.filters = [new BlurFilter({ strength: 10 })];
    this.world.addChild(reefs);

    for (let i = 0; i < 54; i++) {
      const wave = new Graphics()
        .moveTo(-20, 0)
        .bezierCurveTo(-9, -8, 6, 8, 20, 0)
        .stroke({ color: 0xe5fffa, width: this.uiRng.range(2, 5), alpha: this.uiRng.range(0.2, 0.52) });
      wave.position.set(this.uiRng.range(25, WORLD_W - 25), this.uiRng.range(30, WORLD_H - 30));
      wave.rotation = this.uiRng.range(-0.2, 0.2);
      wave.scale.set(this.uiRng.range(0.7, 1.65));
      this.world.addChild(wave);
      this.wavelets.push({ view: wave, speed: this.uiRng.range(8, 18), drift: this.uiRng.range(-1.6, 1.6) });
    }

    for (let i = 0; i < 24; i++) {
      const ripple = new Graphics().circle(0, 0, this.uiRng.range(8, 20)).stroke({ color: 0xffffff, width: 1.5, alpha: this.uiRng.range(0.05, 0.11) });
      ripple.position.set(this.uiRng.range(24, WORLD_W - 24), this.uiRng.range(24, WORLD_H - 24));
      ripple.scale.set(this.uiRng.range(0.6, 1.3), this.uiRng.range(0.24, 0.48));
      ripple.rotation = this.uiRng.range(-0.2, 0.2);
      this.world.addChild(ripple);
    }

    const vignette = new Graphics().ellipse(WORLD_W * 0.5, WORLD_H * 0.48, 600, 316).fill({ color: 0xffffff, alpha: 0.04 });
    vignette.filters = [new BlurFilter({ strength: 18 })];
    this.world.addChild(vignette);
  }

  private createArenaFrame(): void {
    const frame = new Graphics()
      .roundRect(10, 10, WORLD_W - 20, WORLD_H - 20, 32)
      .stroke({ color: 0x071b36, width: 16, alpha: 0.95 })
      .roundRect(18, 18, WORLD_W - 36, WORLD_H - 36, 27)
      .stroke({ color: 0xffe066, width: 4, alpha: 0.9 });
    this.fx.addChild(frame);
  }

  private createIslands(): void {
    const defs = [
      { x: 270, y: 214, lobes: [{ x: -34, y: -8, r: 48 }, { x: 28, y: -20, r: 42 }, { x: 12, y: 34, r: 50 }] },
      { x: 962, y: 198, lobes: [{ x: -40, y: 16, r: 44 }, { x: 26, y: -28, r: 56 }, { x: 48, y: 24, r: 38 }, { x: -6, y: 44, r: 34 }] },
      { x: 412, y: 554, lobes: [{ x: -22, y: -14, r: 34 }, { x: 22, y: -20, r: 42 }, { x: 6, y: 26, r: 36 }] },
      { x: 886, y: 540, lobes: [{ x: -34, y: -10, r: 40 }, { x: 20, y: -18, r: 36 }, { x: 28, y: 24, r: 42 }, { x: -6, y: 30, r: 30 }] },
    ];

    for (const def of defs) {
      const view = new Container();
      const colliders: CircleCollider[] = def.lobes.map((lobe) => ({ x: def.x + lobe.x, y: def.y + lobe.y, radius: lobe.r }));
      const radius = Math.max(...def.lobes.map((lobe) => Math.hypot(lobe.x, lobe.y) + lobe.r));

      const shadow = this.drawIslandLayer(def.lobes, 18, 22, 1.12, 0x073453, 0.28, 0x073453, 0, 20);
      const reef = this.drawIslandLayer(def.lobes, 0, 0, 1.2, 0xcffff4, 0.42, 0x0a607a, 3, 4);
      const shore = this.drawIslandLayer(def.lobes, 0, 0, 1.1, 0xfff4cb, 0.92, 0x0a2d4d, 7);
      const sand = this.drawIslandLayer(def.lobes, 0, 2, 0.98, 0xffd66b, 1, 0xd78941, 5);
      const grass = this.drawIslandLayer(def.lobes, 0, -4, 0.76, 0x9de05a, 0.98, 0x64b73a, 3);
      const canopy = this.drawIslandLayer(def.lobes, 4, -6, 0.56, 0x7ebf34, 0.72, 0, 0);
      const ridge = this.drawIslandLayer(def.lobes, -2, -10, 0.34, 0xb8ee7e, 0.34, 0, 0);

      view.addChild(shadow, reef, shore, sand, grass, canopy, ridge);

      const lagoon = new Graphics();
      lagoon.ellipse(4, -1, radius * 0.22, radius * 0.14).fill({ color: 0x8be7d9, alpha: 0.18 });
      lagoon.rotation = this.uiRng.range(-0.25, 0.25);
      view.addChild(lagoon);

      for (let i = 0; i < 10; i++) {
        const lobe = def.lobes[i % def.lobes.length];
        const rx = lobe.x * this.uiRng.range(0.18, 0.7);
        const ry = lobe.y * this.uiRng.range(0.18, 0.7);
        const tree = new Container();
        const trunk = new Graphics().roundRect(-2, 4, 4, 10, 2).fill(0x754829);
        const leafShadow = new Graphics().ellipse(2, -2, this.uiRng.range(9, 14), this.uiRng.range(8, 12)).fill({ color: 0x356524, alpha: 0.3 });
        const leaves = new Graphics();
        leaves.circle(0, -2, this.uiRng.range(7, 11)).fill(0x3f8b2d);
        leaves.circle(-6, 1, this.uiRng.range(5, 8)).fill(0x5baa3f);
        leaves.circle(6, 1, this.uiRng.range(5, 8)).fill(0x4f9938);
        const highlight = new Graphics().ellipse(-2, -5, this.uiRng.range(3, 5), this.uiRng.range(2, 4)).fill({ color: 0xc9ff93, alpha: 0.34 });
        tree.addChild(trunk, leafShadow, leaves, highlight);
        tree.position.set(rx + this.uiRng.range(-12, 12), ry + this.uiRng.range(-10, 10));
        tree.scale.set(this.uiRng.range(0.72, 1.05));
        tree.rotation = this.uiRng.range(-0.18, 0.18);
        view.addChild(tree);
      }

      for (let i = 0; i < 8; i++) {
        const tuft = new Graphics();
        const angle = this.uiRng.range(0, Math.PI * 2);
        const rr = this.uiRng.range(radius * 0.1, radius * 0.5);
        tuft.ellipse(Math.cos(angle) * rr * 0.6, Math.sin(angle) * rr * 0.44, this.uiRng.range(4, 8), this.uiRng.range(2, 4)).fill({ color: i % 2 ? 0x68aa34 : 0x82c847, alpha: 0.5 });
        view.addChild(tuft);
      }

      for (let i = 0; i < 5; i++) {
        const rock = new Graphics();
        const a = this.uiRng.range(0, Math.PI * 2);
        const rr = this.uiRng.range(radius * 0.18, radius * 0.55);
        const x = Math.cos(a) * rr * 0.56;
        const y = Math.sin(a) * rr * 0.42;
        rock.poly([x - 6, y + 3, x + 4, y - 4, x + 10, y + 2, x + 2, y + 8]).fill(0x6d8552).stroke({ color: 0x41543a, width: 2 });
        const rockHi = new Graphics().ellipse(x - 1, y, 4, 2).fill({ color: 0xd9e6b8, alpha: 0.25 });
        view.addChild(rock, rockHi);
      }

      view.position.set(def.x, def.y);
      view.rotation = 0;
      this.world.addChild(view);
      this.islands.push({ x: def.x, y: def.y, radius, view, colliders });
    }
  }

  private buildBlobPoints(lobes: { x: number; y: number; r: number }[], scale: number, ox = 0, oy = 0): number[] {
    const points: number[] = [];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      let best = 0;
      for (const lobe of lobes) {
        const cx = lobe.x * scale; const cy = lobe.y * scale; const r = lobe.r * scale;
        const px = Math.cos(angle); const py = Math.sin(angle);
        const projection = cx * px + cy * py;
        const centerSq = cx * cx + cy * cy;
        const radialSq = r * r - centerSq + projection * projection;
        if (radialSq > 0) best = Math.max(best, projection + Math.sqrt(radialSq));
      }
      const jitter = 1 + Math.sin(angle * 3.5) * 0.06 + Math.cos(angle * 5.2) * 0.04;
      points.push(ox + Math.cos(angle) * best * jitter, oy + Math.sin(angle) * best * jitter);
    }
    return points;
  }

  private drawIslandLayer(
    lobes: { x: number; y: number; r: number }[],
    offsetX: number,
    offsetY: number,
    scale: number,
    color: number,
    alpha: number,
    strokeColor: number,
    strokeWidth: number,
    blur = 0,
  ): Graphics {
    const g = new Graphics();
    const points = this.buildBlobPoints(lobes, scale, offsetX, offsetY);
    g.poly(points).fill({ color, alpha });
    if (strokeWidth > 0) g.poly(points).stroke({ color: strokeColor, width: strokeWidth, alpha: 0.95 });
    if (blur > 0) g.filters = [new BlurFilter({ strength: blur })];
    return g;
  }

  private makeShipSprite(texturePath: string, tint: number, scale: number): Sprite {
    const sprite = new Sprite(Texture.from(texturePath));
    sprite.anchor.set(0.5);
    sprite.scale.set(scale);
    sprite.tint = tint;
    return sprite;
  }

  private makeShip(id: string, texture: string, tint: number, x: number, y: number, maxHealth: number, scale: number): ShipEntity {
    const view = new Container();
    const body = new Container();
    const shadow = new Graphics().ellipse(9, 14, 42, 24).fill({ color: 0x032334, alpha: 0.4 });
    const outline = this.makeShipSprite(texture, 0x071b36, scale * 1.17);
    outline.alpha = 0.98;
    const sprite = this.makeShipSprite(texture, tint, scale);
    const damageGlow = new Graphics().ellipse(-3, -14, 16, 11).fill({ color: 0xff8d4d, alpha: 0.32 });
    damageGlow.filters = [new BlurFilter({ strength: 6 })];
    damageGlow.alpha = 0;
    const damageFx = new Sprite(Texture.from(GAME_ASSETS.fire));
    damageFx.anchor.set(0.5, 0.82); damageFx.position.set(-4, -20); damageFx.scale.set(0.74); damageFx.alpha = 0;
    const healthBack = new Graphics();
    const healthFill = new Graphics();
    const marker = new Graphics().circle(0, 0, 39).stroke({ color: tint, width: 4, alpha: 0.7 });
    marker.scale.set(1.0, 0.82);

    // The supplied ship PNGs point DOWN in texture space.
    // Rotate only the ship body by -90deg relative to the simulation heading,
    // while keeping health bars upright in screen space.
    body.addChild(shadow, outline, marker, sprite, damageGlow, damageFx);
    view.addChild(body, healthBack, healthFill);
    view.position.set(x, y);
    this.world.addChild(view);
    const entity: ShipEntity = { id, x, y, rotation: -Math.PI / 2, radius: 28, health: maxHealth, maxHealth, alive: true, view, body, sprite, outline, damageFx, damageGlow, baseScale: scale, healthBack, healthFill };
    body.rotation = entity.rotation - Math.PI / 2;
    this.updateHealth(entity);
    return entity;
  }

  private createPlayer(): void {
    this.player = this.makeShip(PLAYER_ID, GAME_ASSETS.player, 0xffdf59, WORLD_W / 2, WORLD_H / 2, this.config.playerMaxHealth, 0.62);
  }

  private spawnEnemy(): boolean {
    const activeEnemyCount = this.enemies.filter((enemy) => enemy.alive).length;
    if (activeEnemyCount >= this.maxActiveEnemies) return false;
    const spawnIndex = this.spawnSequence;
    const pattern = EXTRA_BALANCE.spawn.enemyTypePattern;
    const kind = pattern[spawnIndex % pattern.length]!;
    const candidates: { x: number; y: number }[] = [];

    // Generate enough deterministic edge candidates that a failed spawn never falls back
    // to an island, another ship or the player's immediate danger zone.
    for (let i = 0; i < 24; i++) {
      const edge = this.rng.int(0, 3);
      const pad = 84;
      if (edge === 0) candidates.push({ x: pad, y: this.rng.range(pad, WORLD_H - pad) });
      if (edge === 1) candidates.push({ x: WORLD_W - pad, y: this.rng.range(pad, WORLD_H - pad) });
      if (edge === 2) candidates.push({ x: this.rng.range(pad, WORLD_W - pad), y: pad });
      if (edge === 3) candidates.push({ x: this.rng.range(pad, WORLD_W - pad), y: WORLD_H - pad });
    }

    // Deterministic edge slots guarantee broad coverage even when the random candidates
    // happen to cluster around blocked sections of coastline.
    const pad = 84;
    for (let slot = 1; slot <= 8; slot++) {
      const tx = pad + (WORLD_W - pad * 2) * (slot / 9);
      const ty = pad + (WORLD_H - pad * 2) * (slot / 9);
      candidates.push({ x: tx, y: pad }, { x: tx, y: WORLD_H - pad });
      candidates.push({ x: pad, y: ty }, { x: WORLD_W - pad, y: ty });
    }

    const position = candidates.find((point) =>
      distSq(point.x, point.y, this.player.x, this.player.y) > 285 ** 2
      && !this.collidesIsland(point.x, point.y, 34)
      && this.enemies.every((enemy) => !enemy.alive || distSq(point.x, point.y, enemy.x, enemy.y) > 118 ** 2)
    );

    if (!position) {
      // Retry soon instead of spawning in an invalid location. The failed attempt remains
      // deterministic and avoids unavoidable contact damage.
      this.spawnClock = Math.max(this.spawnClock, this.config.enemySpawnTime * 0.72);
      return false;
    }

    const tint = kind === 'chaser' ? 0xff575d : 0xca63ff;
    const texture = kind === 'chaser' ? GAME_ASSETS.chaser : GAME_ASSETS.shooter;
    const lowPressureToughness = Math.max(0, 1 - this.pressure) * 0.10;
    const healthMultiplier = clamp(1 + lowPressureToughness - Math.max(0, this.pressure - 1) * 0.14, 0.76, 1.04);
    const baseHealth = kind === 'chaser' ? 68 : 82;
    this.spawnSequence += 1;
    const enemy = this.makeShip(`enemy-${spawnIndex}`, texture, tint, position.x, position.y, Math.round(baseHealth * healthMultiplier), 0.52) as EnemyEntity;
    enemy.kind = kind;
    enemy.shootCooldown = this.rng.range(0.5, 1.25);
    enemy.preferredOrbitSign = this.rng.next() < 0.5 ? -1 : 1;
    enemy.orbitFlipCooldown = 0;
    enemy.stuckTime = 0;
    enemy.lastAiX = position.x;
    enemy.lastAiY = position.y;
    enemy.rotation = Math.atan2(this.player.y - position.y, this.player.x - position.x);
    enemy.body.rotation = enemy.rotation - Math.PI / 2;
    this.enemies.push(enemy);
    this.popLabel(engineText(kind === 'chaser' ? 'chaser' : 'shooter'), position.x, position.y - 48, tint, 0.75);
    return true;
  }

  private tick = (ticker: { deltaMS: number }): void => {
    if (!this.started || this.paused || this.ended) return;
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    this.elapsed += dt;
    this.spawnClock += dt;
    this.frontCooldown = Math.max(0, this.frontCooldown - dt);
    this.broadsideCooldown = Math.max(0, this.broadsideCooldown - dt);
    this.weaponSwitchCooldown = Math.max(0, this.weaponSwitchCooldown - dt);
    this.bufferedWeaponActionTime = Math.max(0, this.bufferedWeaponActionTime - dt);
    if (this.bufferedWeaponActionTime <= 0) this.bufferedWeaponAction = null;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.barrelCooldown = Math.max(0, this.barrelCooldown - dt);
    this.powderTime = Math.max(0, this.powderTime - dt);
    this.windTime = Math.max(0, this.windTime - dt);
    this.armorTime = Math.max(0, this.armorTime - dt);
    this.streakClock = Math.max(0, this.streakClock - dt);
    this.shipContactSoundCooldown = Math.max(0, this.shipContactSoundCooldown - dt);
    this.shipContactFxCooldown = Math.max(0, this.shipContactFxCooldown - dt);
    this.timeSincePlayerDamage += dt;
    this.timeSincePlayerVictory += dt;
    this.timeSincePlayerOffense += dt;
    this.supportClock += dt;
    for (const wave of this.wavelets) {
      wave.view.x += wave.speed * dt;
      wave.view.y += Math.sin(this.elapsed * 1.8 + wave.drift) * 1.2 * dt;
      if (wave.view.x > WORLD_W + 30) wave.view.x = -30;
    }
    if (this.streakClock === 0) this.streak = 0;

    this.updatePlayer(dt);
    // Resolve projectiles before enemy contact so a ship destroyed by a shot cannot
    // continue into the later AI/collision phase of the same simulation tick.
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.animateShipDamageFx(this.player);
    for (const enemy of this.enemies) if (enemy.alive) this.animateShipDamageFx(enemy);
    this.updatePowderBarrels(dt);
    this.updatePickups(dt);
    this.maybeSpawnSupportDrop();

    if (this.spawnClock >= this.config.enemySpawnTime) {
      this.spawnClock -= this.config.enemySpawnTime;
      this.spawnEnemy();
    }

    this.maybeShowIdleComicPanel(dt);
    if (this.elapsed >= this.config.sessionTime) this.finish('timeout');
    this.emitSnapshot(false);
  };

  private updatePlayer(dt: number): void {
    if (this.input.isDown('left')) this.player.rotation -= this.config.playerRotationSpeed * dt;
    if (this.input.isDown('right')) this.player.rotation += this.config.playerRotationSpeed * dt;

    const dashDown = this.input.isDown('dash');
    if (dashDown && !this.dashWasDown && this.dashCooldown <= 0) this.performDash();
    this.dashWasDown = dashDown;

    const barrelDown = this.input.isDown('barrel');
    if (barrelDown && !this.barrelWasDown && this.barrelCooldown <= 0) this.deployPowderBarrel();
    this.barrelWasDown = barrelDown;

    const speedBoost = this.windTime > 0 ? EXTRA_BALANCE.powerups.windSpeedMultiplier : 1;
    if (this.input.isDown('forward')) {
      const moveSpeed = this.config.playerSpeed * speedBoost;
      const nx = this.player.x + Math.cos(this.player.rotation) * moveSpeed * dt;
      const ny = this.player.y + Math.sin(this.player.rotation) * moveSpeed * dt;
      this.tryMove(this.player, nx, ny);
      this.wakeClock += dt;
      if (this.wakeClock >= 0.055) { this.wakeClock = 0; this.spawnWake(); }
    } else {
      this.wakeClock = Math.min(this.wakeClock + dt, 0.055);
    }

    const turning = (this.input.isDown('left') ? -1 : 0) + (this.input.isDown('right') ? 1 : 0);
    this.player.sprite.skew.x = turning * 0.08;
    this.player.outline.skew.x = turning * 0.08;
    this.player.outline.tint = this.armorTime > 0 ? 0xffd34d : 0x071b36;
    this.player.body.rotation = this.player.rotation - Math.PI / 2;
    this.player.body.y = Math.sin(this.elapsed * 4.6) * 1.6;
    const powderBoost = this.powderTime > 0;
    if (this.input.isDown('fire') && this.frontCooldown <= 0 && this.canFireWeaponNow()) this.fireFront();

    const leftBroadsideDown = this.input.isDown('broadsideLeft');
    const rightBroadsideDown = this.input.isDown('broadsideRight');
    if (powderBoost) {
      if (this.broadsideCooldown <= 0 && (leftBroadsideDown || rightBroadsideDown)) {
        // Living Powder is the deliberate exception to the normal one-direction-at-a-time rule:
        // both gun decks may fire together and the front cannon can fire in the same moment.
        if (leftBroadsideDown) this.fireBroadside(-1, false);
        if (rightBroadsideDown) this.fireBroadside(1, false);
        this.broadsideCooldownMax = this.config.frontCooldown * EXTRA_BALANCE.powerups.powderFrontCooldownMultiplier;
        this.broadsideCooldown = this.broadsideCooldownMax;
      }
    } else {
      // Normal rules: left/right share one reload and a short global weapon lock prevents
      // front + broadside from firing at the same instant. Holding a key naturally waits
      // for the lock; quick touch taps are buffered below so controls stay responsive.
      if (leftBroadsideDown && this.broadsideCooldown <= 0 && this.canFireWeaponNow()) this.fireBroadside(-1);
      if (rightBroadsideDown && this.broadsideCooldown <= 0 && this.canFireWeaponNow()) this.fireBroadside(1);
      this.consumeBufferedWeaponAction();
    }
  }

  private performDash(): void {
    const cooldownBase = EXTRA_BALANCE.dash.baseCooldown;
    const pressureAssist = clamp(1 - Math.max(0, this.pressure - 1) * 0.09, 0.78, 1);
    const windAssist = this.windTime > 0 ? 0.72 : 1;
    this.dashCooldownMax = cooldownBase * pressureAssist * windAssist;
    this.dashCooldown = this.dashCooldownMax;
    this.playSound('dash');

    const totalDistance = this.windTime > 0 ? EXTRA_BALANCE.dash.windDistance : EXTRA_BALANCE.dash.distance;
    const steps = 11;
    const stepDistance = totalDistance / steps;
    const startX = this.player.x;
    const startY = this.player.y;
    for (let i = 0; i < steps; i++) {
      const nx = this.player.x + Math.cos(this.player.rotation) * stepDistance;
      const ny = this.player.y + Math.sin(this.player.rotation) * stepDistance;
      if (!this.tryMove(this.player, nx, ny)) break;
    }

    const moved = Math.hypot(this.player.x - startX, this.player.y - startY);
    if (moved > 4) {
      this.spawnDashWake(startX, startY, this.player.x, this.player.y);
      this.spawnActionLines(this.player.x, this.player.y, this.player.rotation, 0x9bfff5, 9);
      this.shake(4, 0.1);
      this.showMechanicComicPanel('dash', gameLines('dash'));
    }
  }

  private deployPowderBarrel(): void {
    if (this.powderBarrels.filter((barrel) => barrel.alive).length >= EXTRA_BALANCE.powderBarrel.maxActive) {
      this.popLabel(engineText('barrelsFull'), this.player.x, this.player.y - 62, 0xffd75a, 0.55);
      return;
    }

    const backAngle = this.player.rotation + Math.PI;
    const candidates = [
      { angle: backAngle, distance: 58 },
      { angle: backAngle + 0.42, distance: 64 },
      { angle: backAngle - 0.42, distance: 64 },
      { angle: backAngle, distance: 78 },
    ];
    const placement = candidates
      .map(({ angle, distance }) => ({
        x: this.player.x + Math.cos(angle) * distance,
        y: this.player.y + Math.sin(angle) * distance,
      }))
      .find(({ x, y }) => this.canPlacePowderBarrel(x, y));

    if (!placement) {
      this.popLabel(engineText('noBarrelSpace'), this.player.x, this.player.y - 62, 0xffd75a, 0.58);
      return;
    }

    const pressureAssist = clamp(1 - Math.max(0, this.pressure - 1) * 0.055, 0.82, 1);
    this.barrelCooldownMax = EXTRA_BALANCE.powderBarrel.baseCooldown * pressureAssist;
    this.barrelCooldown = this.barrelCooldownMax;

    const view = new Container();
    const shadow = new Graphics().ellipse(0, 13, 26, 9).fill({ color: 0x032334, alpha: 0.32 });
    const halo = new Graphics().circle(0, 0, 23).stroke({ color: 0xff775d, width: 5, alpha: 0.3 });
    halo.filters = [new BlurFilter({ strength: 4 })];
    const body = new Graphics()
      .roundRect(-15, -18, 30, 36, 9)
      .fill(0x9a5638)
      .stroke({ color: 0x071b36, width: 5 });
    const bandA = new Graphics().rect(-16, -9, 32, 5).fill(0x273c50);
    const bandB = new Graphics().rect(-16, 7, 32, 5).fill(0x273c50);
    const fuse = new Graphics()
      .moveTo(7, -16)
      .bezierCurveTo(18, -25, 20, -11, 12, -6)
      .stroke({ color: 0xf5d278, width: 4 });
    const spark = new Graphics().star(17, -21, 6, 8, 3).fill(0xfff08a);
    view.addChild(shadow, halo, body, bandA, bandB, fuse, spark);
    view.position.set(placement.x, placement.y);
    this.world.addChild(view);

    this.powderBarrels.push({
      id: `barrel-${this.elapsed.toFixed(3)}-${this.powderBarrels.length}`,
      x: placement.x,
      y: placement.y,
      radius: 22,
      blastRadius: EXTRA_BALANCE.powderBarrel.blastRadius,
      damage: EXTRA_BALANCE.powderBarrel.damage,
      lifetime: EXTRA_BALANCE.powderBarrel.lifetime,
      armTime: EXTRA_BALANCE.powderBarrel.armTime,
      alive: true,
      view,
    });

    this.playSound('pickup');
    this.spawnSparkBurst(placement.x, placement.y, 0xffd75a, 6);
    this.popLabel(engineText('barrelArmed'), placement.x, placement.y - 42, 0xffd75a, 0.55);
    this.showMechanicComicPanel('barrel', gameLines('barrel'));
  }

  private canPlacePowderBarrel(x: number, y: number): boolean {
    if (x < 58 || x > WORLD_W - 58 || y < 58 || y > WORLD_H - 58) return false;
    if (this.collidesIsland(x, y, 28)) return false;
    if (distSq(x, y, this.player.x, this.player.y) < 48 ** 2) return false;
    if (this.enemies.some((enemy) => enemy.alive && distSq(x, y, enemy.x, enemy.y) < 58 ** 2)) return false;
    if (this.powderBarrels.some((barrel) => barrel.alive && distSq(x, y, barrel.x, barrel.y) < 64 ** 2)) return false;
    return true;
  }

  private updatePowderBarrels(dt: number): void {
    for (const barrel of this.powderBarrels) {
      if (!barrel.alive) continue;
      barrel.lifetime -= dt;
      barrel.armTime = Math.max(0, barrel.armTime - dt);
      barrel.view.y = barrel.y + Math.sin(this.elapsed * 5.4 + barrel.x * 0.02) * 2.6;
      barrel.view.rotation = Math.sin(this.elapsed * 2.3 + barrel.y * 0.01) * 0.055;
      barrel.view.alpha = barrel.lifetime < 1.8
        ? 0.45 + (Math.sin(this.elapsed * 17) * 0.5 + 0.5) * 0.55
        : 1;

      if (barrel.armTime <= 0) {
        const target = this.enemies.find((enemy) => enemy.alive && distSq(barrel.x, barrel.y, enemy.x, enemy.y) <= (EXTRA_BALANCE.powderBarrel.triggerRadius + enemy.radius) ** 2);
        if (target) {
          this.detonatePowderBarrel(barrel, target);
          continue;
        }
      }

      if (barrel.lifetime <= 0) {
        barrel.alive = false;
        if (!barrel.view.destroyed) barrel.view.destroy({ children: true });
      }
    }
    this.powderBarrels = this.powderBarrels.filter((barrel) => barrel.alive);
  }

  private detonatePowderBarrel(barrel: PowderBarrelEntity, triggerEnemy: EnemyEntity): void {
    if (!barrel.alive) return;
    barrel.alive = false;
    const x = barrel.x;
    const y = barrel.y;
    if (!barrel.view.destroyed) barrel.view.destroy({ children: true });

    this.playSound('explosion');
    this.explosion(x, y);
    this.spawnActionLines(x, y, 0, 0xff875f, 14);
    const blast = new Graphics().circle(0, 0, barrel.blastRadius).stroke({ color: 0xffe066, width: 7, alpha: 0.62 });
    blast.position.set(x, y);
    this.fx.addChild(blast);
    let blastLife = 0.25;
    const update = (ticker: { deltaMS: number }) => {
      blastLife -= ticker.deltaMS / 1000;
      const p = 1 - Math.max(0, blastLife / 0.25);
      blast.scale.set(0.55 + p * 0.65);
      blast.alpha = Math.max(0, blastLife / 0.25) * 0.62;
      if (blastLife <= 0) {
        this.app.ticker.remove(update);
        blast.destroy();
      }
    };
    this.app.ticker.add(update);

    // A barrel hit is also an offensive combat action by the player. Keep the
    // captain out of the idle-react state until combat has genuinely gone quiet.
    this.markPlayerOffense();

    // The ship that actually hits the trap is the guaranteed kill. Nearby ships
    // receive a heavy concussion, but the shockwave can never finish them off.
    if (triggerEnemy.alive) this.destroyEnemy(triggerEnemy, true);

    for (const enemy of [...this.enemies]) {
      if (!enemy.alive || enemy.id === triggerEnemy.id) continue;
      const distance = Math.hypot(enemy.x - x, enemy.y - y);
      if (distance > barrel.blastRadius + enemy.radius) continue;
      const falloff = clamp(1 - Math.max(0, distance - 26) / Math.max(1, barrel.blastRadius), 0.62, 1);
      const shockDamage = barrel.damage * 1.08 * falloff;
      const nonLethalDamage = Math.min(shockDamage, Math.max(0, enemy.health - 1));
      if (nonLethalDamage > 0) this.damageShip(enemy, nonLethalDamage);
    }

    // Player is intentionally immune to their own powder barrel blast.
    this.popLabel(engineText('powderBlast'), x, y - 62, 0xffe066, 0.6);
    this.powderBarrels = this.powderBarrels.filter((candidate) => candidate.alive);
  }

  private hasLineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(2, Math.ceil(distance / 34));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.collidesIsland(ax + dx * t, ay + dy * t, 7)) return false;
    }
    return true;
  }

  private steerForEnemy(enemy: EnemyEntity, targetX: number, targetY: number): { x: number; y: number; distance: number; lineOfSight: boolean } {
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    const directX = dx / distance;
    const directY = dy / distance;
    const lineOfSight = enemy.kind === 'shooter' ? this.hasLineOfSight(enemy.x, enemy.y, targetX, targetY) : true;
    let steerX = directX;
    let steerY = directY;

    if (enemy.kind === 'shooter') {
      const idealRange = this.config.shooterRange * 0.82;
      const orbitX = -directY * enemy.preferredOrbitSign;
      const orbitY = directX * enemy.preferredOrbitSign;

      if (!lineOfSight) {
        // Keep circling the obstacle until the cannon lane opens instead of ramming it.
        steerX = directX * 0.48 + orbitX * 1.15;
        steerY = directY * 0.48 + orbitY * 1.15;
      } else if (distance < idealRange * 0.72) {
        steerX = -directX * 1.15 + orbitX * 0.72;
        steerY = -directY * 1.15 + orbitY * 0.72;
      } else if (distance < idealRange * 1.15) {
        steerX = directX * 0.08 + orbitX * 0.88;
        steerY = directY * 0.08 + orbitY * 0.88;
      }
    }

    // Separation prevents high-density matches from turning into one solid enemy blob.
    for (const other of this.enemies) {
      if (!other.alive || other === enemy) continue;
      const sx = enemy.x - other.x;
      const sy = enemy.y - other.y;
      const safe = enemy.radius + other.radius + EXTRA_BALANCE.ai.separationPadding;
      const separationSq = sx * sx + sy * sy;
      if (separationSq >= safe * safe) continue;
      const separation = Math.sqrt(separationSq) || 0.0001;
      const weight = (safe - separation) / safe;
      steerX += (sx / separation) * (2.35 * weight);
      steerY += (sy / separation) * (2.35 * weight);
      steerX += (-sy / separation) * (0.34 * weight) * enemy.preferredOrbitSign;
      steerY += (sx / separation) * (0.34 * weight) * enemy.preferredOrbitSign;
    }

    // Repel from island lobes plus a look-ahead point so ships turn before touching land.
    const preliminaryLength = Math.hypot(steerX, steerY) || 1;
    const aheadX = enemy.x + (steerX / preliminaryLength) * EXTRA_BALANCE.ai.lookAheadDistance;
    const aheadY = enemy.y + (steerY / preliminaryLength) * EXTRA_BALANCE.ai.lookAheadDistance;
    for (const island of this.islands) {
      for (const collider of island.colliders) {
        const applyAvoidance = (px: number, py: number, multiplier: number) => {
          const ix = px - collider.x;
          const iy = py - collider.y;
          const dist = Math.hypot(ix, iy) || 0.0001;
          const safe = enemy.radius + collider.radius + 42;
          if (dist >= safe) return;
          const weight = (safe - dist) / safe;
          steerX += (ix / dist) * (2.95 * weight * multiplier);
          steerY += (iy / dist) * (2.95 * weight * multiplier);
          steerX += (-iy / dist) * (1.08 * weight * multiplier) * enemy.preferredOrbitSign;
          steerY += (ix / dist) * (1.08 * weight * multiplier) * enemy.preferredOrbitSign;
        };
        applyAvoidance(enemy.x, enemy.y, 1);
        applyAvoidance(aheadX, aheadY, 0.78);
      }
    }

    if (enemy.stuckTime > EXTRA_BALANCE.ai.stuckRecoverySeconds) {
      const tangentX = -directY * enemy.preferredOrbitSign;
      const tangentY = directX * enemy.preferredOrbitSign;
      const recovery = clamp(enemy.stuckTime * 2.1, 0.7, 2.1);
      steerX += tangentX * recovery;
      steerY += tangentY * recovery;
    }

    const edgePad = 96;
    if (enemy.x < edgePad) steerX += (edgePad - enemy.x) / edgePad * 1.5;
    if (enemy.x > WORLD_W - edgePad) steerX -= (enemy.x - (WORLD_W - edgePad)) / edgePad * 1.5;
    if (enemy.y < edgePad) steerY += (edgePad - enemy.y) / edgePad * 1.5;
    if (enemy.y > WORLD_H - edgePad) steerY -= (enemy.y - (WORLD_H - edgePad)) / edgePad * 1.5;

    const len = Math.hypot(steerX, steerY) || 1;
    return { x: steerX / len, y: steerY / len, distance, lineOfSight };
  }

  private rotateTowards(current: number, target: number, maxStep: number): number {
    const diff = angleWrap(target - current);
    return current + clamp(diff, -maxStep, maxStep);
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.orbitFlipCooldown = Math.max(0, enemy.orbitFlipCooldown - dt);
      const previousX = enemy.x;
      const previousY = enemy.y;
      const steer = this.steerForEnemy(enemy, this.player.x, this.player.y);
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const distance = steer.distance;
      const targetAngle = Math.atan2(steer.y, steer.x);

      if (enemy.kind === 'chaser') {
        if (distance < 180 && !enemy.warned) {
          enemy.warned = true;
          this.popLabel(engineText('ramWarning'), enemy.x, enemy.y - 62, 0xfff36b, 0.65);
        }
        if (distance > 235) enemy.warned = false;
      }

      const turnRate = enemy.kind === 'chaser' ? 4.05 : 3.35;
      enemy.rotation = this.rotateTowards(enemy.rotation, targetAngle, turnRate * dt);
      enemy.body.rotation = enemy.rotation - Math.PI / 2;
      enemy.body.y = Math.sin(this.elapsed * 4 + enemy.x * 0.012 + enemy.y * 0.007) * 1.25;

      let moveFactor = 1;
      if (enemy.kind === 'shooter') {
        const idealRange = this.config.shooterRange * 0.82;
        if (steer.lineOfSight && distance > idealRange * 0.72 && distance < idealRange * 1.15) moveFactor = 0.54;
        if (!steer.lineOfSight) moveFactor = 0.9;
      }

      const calmTempoBoost = 1 + Math.max(0, 1 - this.pressure) * 0.16;
      const overloadEase = 1 - Math.max(0, this.pressure - 1) * 0.025;
      const adaptiveSpeed = clamp(calmTempoBoost * overloadEase, 0.96, 1.06);
      const speed = this.config.enemySpeed * (enemy.kind === 'chaser' ? 1.15 : 0.84) * moveFactor * adaptiveSpeed;
      const nx = enemy.x + Math.cos(enemy.rotation) * speed * dt;
      const ny = enemy.y + Math.sin(enemy.rotation) * speed * dt;
      let moved = this.tryMove(enemy, nx, ny);

      if (!enemy.alive) continue;
      if (!moved) {
        // Collision fan: try several deterministic escape vectors instead of oscillating
        // against the same hull/island edge. Persistent orbit sign makes the choice stable.
        const fan = [0.48, 0.7, -0.42, 0.92].map((turn) => turn * Math.PI * enemy.preferredOrbitSign);
        for (const offset of fan) {
          const dodgeAngle = enemy.rotation + offset;
          if (this.tryMove(
            enemy,
            enemy.x + Math.cos(dodgeAngle) * speed * 0.78 * dt,
            enemy.y + Math.sin(dodgeAngle) * speed * 0.78 * dt,
          )) {
            moved = true;
            break;
          }
        }

        // Last-resort unjam: a very small reverse step is allowed only through the same
        // collision solver, so it can never phase through islands or another ship.
        if (!moved && enemy.stuckTime > 0.34) {
          const reverseAngle = enemy.rotation + Math.PI;
          moved = this.tryMove(
            enemy,
            enemy.x + Math.cos(reverseAngle) * speed * 0.34 * dt,
            enemy.y + Math.sin(reverseAngle) * speed * 0.34 * dt,
          );
        }
        if (!moved && enemy.stuckTime > 0.52 && enemy.orbitFlipCooldown <= 0) {
          enemy.preferredOrbitSign = enemy.preferredOrbitSign === 1 ? -1 : 1;
          enemy.orbitFlipCooldown = 0.9;
          enemy.stuckTime = 0.24;
          enemy.rotation += enemy.preferredOrbitSign * 0.28;
        }
      }

      const movedDistance = Math.hypot(enemy.x - previousX, enemy.y - previousY);
      if (movedDistance < Math.max(0.35, speed * dt * 0.15)) enemy.stuckTime += dt;
      else enemy.stuckTime = Math.max(0, enemy.stuckTime - dt * 2.4);
      enemy.lastAiX = enemy.x;
      enemy.lastAiY = enemy.y;

      if (enemy.kind === 'shooter') {
        enemy.shootCooldown -= dt;
        const canShoot = distance <= this.config.shooterRange && steer.lineOfSight;
        if (canShoot && enemy.shootCooldown <= 0.34 && !enemy.telegraphing) {
          enemy.telegraphing = true;
          this.popLabel(engineText('aim'), enemy.x, enemy.y - 60, 0xff79d4, 0.36);
          this.aimFlash(enemy.x, enemy.y, this.player.x, this.player.y);
        }
        if (canShoot && enemy.shootCooldown <= 0) {
          const shotAngle = Math.atan2(dy, dx);
          const muzzleX = enemy.x + Math.cos(shotAngle) * 28;
          const muzzleY = enemy.y + Math.sin(shotAngle) * 28;
          const enemyDamageMultiplier = clamp(1 - Math.max(0, this.pressure - 1) * 0.1, 0.84, 1);
          this.createProjectile('enemy', muzzleX, muzzleY, shotAngle, this.config.enemyProjectileDamage * enemyDamageMultiplier, 0xff7dc8);
          enemy.shootCooldown = 1.45 * (1 + Math.max(0, this.pressure - 1) * 0.11);
          enemy.telegraphing = false;
        } else if (!canShoot) {
          enemy.telegraphing = false;
          if (enemy.shootCooldown < 0.12) {
            // Keep a tiny buffer so a shooter does not instantly fire on the exact frame
            // a blocked line of sight reopens.
            enemy.shootCooldown = 0.12;
          }
        }
      }

      if (enemy.kind === 'chaser' && distSq(enemy.x, enemy.y, this.player.x, this.player.y) < (enemy.radius + this.player.radius) ** 2) {
        this.playShipContactSound();
        const chaserDamageMultiplier = clamp(1 - Math.max(0, this.pressure - 1) * 0.1, 0.84, 1);
        this.damageShip(this.player, this.config.chaserCollisionDamage * chaserDamageMultiplier);
        this.destroyEnemy(enemy, false, this.player.alive);
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const projectile of this.projectiles) {
      if (!projectile.alive) continue;
      projectile.lifetime -= dt;
      const travelX = projectile.vx * dt;
      const travelY = projectile.vy * dt;
      const travelDistance = Math.hypot(travelX, travelY);
      const steps = Math.max(1, Math.ceil(travelDistance / 8));
      const stepX = travelX / steps;
      const stepY = travelY / steps;

      for (let step = 0; step < steps && projectile.alive; step++) {
        projectile.x += stepX;
        projectile.y += stepY;

        if (projectile.x < 24 || projectile.x > WORLD_W - 24 || projectile.y < 24 || projectile.y > WORLD_H - 24 || this.collidesIsland(projectile.x, projectile.y, projectile.radius)) {
          this.spawnSparkBurst(projectile.x, projectile.y, 0xe8fff8, 3);
          this.removeProjectile(projectile);
          break;
        }

        if (projectile.owner === 'player') {
          for (const enemy of this.enemies) {
            if (!enemy.alive) continue;
            if (distSq(projectile.x, projectile.y, enemy.x, enemy.y) < (projectile.radius + enemy.radius) ** 2) {
              this.playProjectileHitSound();
              this.spawnSparkBurst(projectile.x, projectile.y, 0xffef8b, 6);
              this.markPlayerOffense();
              this.damageShip(enemy, projectile.damage);
              this.removeProjectile(projectile);
              break;
            }
          }
        } else if (this.player.alive && distSq(projectile.x, projectile.y, this.player.x, this.player.y) < (projectile.radius + this.player.radius) ** 2) {
          this.playProjectileHitSound();
          this.spawnSparkBurst(projectile.x, projectile.y, 0xff7dc8, 5);
          this.damageShip(this.player, projectile.damage);
          this.removeProjectile(projectile);
        }
      }

      if (!projectile.alive) continue;
      if (projectile.lifetime <= 0) {
        this.removeProjectile(projectile);
        continue;
      }

      projectile.view.position.set(projectile.x, projectile.y);
      const progress = clamp(1 - projectile.lifetime / Math.max(0.001, projectile.totalLifetime), 0, 1);
      const arcHeight = Math.sin(progress * Math.PI) * (projectile.owner === 'player' ? 12 : 8);
      const localArcX = -Math.sin(projectile.view.rotation) * arcHeight;
      const localArcY = -Math.cos(projectile.view.rotation) * arcHeight;
      if (projectile.ball) projectile.ball.position.set(localArcX, localArcY);
      if (projectile.glow) {
        projectile.glow.position.set(localArcX, localArcY);
        const pulse = 1 + Math.sin(this.elapsed * 22 + projectile.x * 0.015) * 0.16;
        projectile.glow.scale.set(pulse);
        projectile.glow.alpha = (projectile.owner === 'player' ? 0.58 : 0.4) * (0.78 + Math.sin(this.elapsed * 18) * 0.22);
      }
      if (projectile.shadow) {
        projectile.shadow.alpha = 0.34 * (1 - arcHeight / 22);
        projectile.shadow.scale.set(1 - arcHeight / 38, 1 - arcHeight / 52);
      }
      if (projectile.owner === 'player' && this.visualParticleCount < 96 && this.uiRng.next() < 0.12) {
        this.spawnSparkBurst(projectile.x - stepX * 0.6, projectile.y - stepY * 0.6, 0xfff2a8, 1);
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => projectile.alive);
    this.enemies = this.enemies.filter((enemy) => enemy.alive || enemy.view.parent !== null);
  }

  private tryMove(ship: ShipEntity, nx: number, ny: number): boolean {
    if (!ship.alive) return false;
    const x = clamp(nx, ship.radius + 30, WORLD_W - ship.radius - 30);
    const y = clamp(ny, ship.radius + 30, WORLD_H - ship.radius - 30);
    if (this.collidesIsland(x, y, ship.radius)) return false;

    const other = this.findBlockingShip(ship, x, y);
    if (other) {
      const playerInvolved = ship.id === PLAYER_ID || other.id === PLAYER_ID;
      const enemyShip = ship.id === PLAYER_ID ? other : ship;
      const chaser = enemyShip.id !== PLAYER_ID && (enemyShip as EnemyEntity).kind === 'chaser'
        ? enemyShip as EnemyEntity
        : undefined;

      if (playerInvolved) {
        this.playShipContactSound();
        if (this.shipContactFxCooldown <= 0) {
          this.shipContactFxCooldown = 0.16;
          this.impactBurst((ship.x + other.x) * 0.5, (ship.y + other.y) * 0.5);
        }
      }

      if (playerInvolved && chaser?.alive) {
        const chaserDamageMultiplier = clamp(1 - Math.max(0, this.pressure - 1) * 0.1, 0.84, 1);
        this.damageShip(this.player, this.config.chaserCollisionDamage * chaserDamageMultiplier);
        this.destroyEnemy(chaser, false, this.player.alive);
        return false;
      }

      // If two solid ships somehow start overlapped, allow only movement that increases separation.
      // This prevents permanent sticking while still forbidding traversal through another hull.
      const minDistance = ship.radius + other.radius;
      const currentDistanceSq = distSq(ship.x, ship.y, other.x, other.y);
      const nextDistanceSq = distSq(x, y, other.x, other.y);
      if (currentDistanceSq < minDistance ** 2 && nextDistanceSq > currentDistanceSq) {
        ship.x = x; ship.y = y; ship.view.position.set(x, y);
        return true;
      }

      // Shooter/player and enemy/enemy contacts are solid but non-damaging.
      return false;
    }

    ship.x = x; ship.y = y; ship.view.position.set(x, y);
    return true;
  }

  private findBlockingShip(ship: ShipEntity, x: number, y: number): ShipEntity | undefined {
    if (ship.id !== PLAYER_ID && this.player.alive) {
      if (distSq(x, y, this.player.x, this.player.y) < (ship.radius + this.player.radius) ** 2) return this.player;
    }
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy === ship) continue;
      if (distSq(x, y, enemy.x, enemy.y) < (ship.radius + enemy.radius) ** 2) return enemy;
    }
    return undefined;
  }

  private collidesIsland(x: number, y: number, radius: number): boolean {
    return this.islands.some((island) => island.colliders.some((collider) => distSq(x, y, collider.x, collider.y) < (radius + collider.radius) ** 2));
  }

  private canFireWeaponNow(): boolean {
    return this.powderTime > 0 || this.weaponSwitchCooldown <= 0;
  }

  private markWeaponFired(): void {
    if (this.powderTime <= 0) this.weaponSwitchCooldown = EXTRA_BALANCE.weapons.switchLockSeconds;
  }

  private bufferWeaponAction(action: Extract<GameAction, 'fire' | 'broadsideLeft' | 'broadsideRight'>): void {
    this.bufferedWeaponAction = action;
    this.bufferedWeaponActionTime = EXTRA_BALANCE.weapons.inputBufferSeconds;
  }

  private consumeBufferedWeaponAction(): void {
    if (!this.bufferedWeaponAction || this.bufferedWeaponActionTime <= 0 || !this.canFireWeaponNow()) return;
    const action = this.bufferedWeaponAction;
    if (action === 'fire' && this.frontCooldown <= 0) {
      this.bufferedWeaponAction = null;
      this.bufferedWeaponActionTime = 0;
      this.fireFront();
    } else if (action === 'broadsideLeft' && this.broadsideCooldown <= 0) {
      this.bufferedWeaponAction = null;
      this.bufferedWeaponActionTime = 0;
      this.fireBroadside(-1);
    } else if (action === 'broadsideRight' && this.broadsideCooldown <= 0) {
      this.bufferedWeaponAction = null;
      this.bufferedWeaponActionTime = 0;
      this.fireBroadside(1);
    }
  }

  private fireFront(): void {
    const powderBoost = this.powderTime > 0;
    this.frontCooldownMax = this.config.frontCooldown * (powderBoost ? EXTRA_BALANCE.powerups.powderFrontCooldownMultiplier : 1);
    this.frontCooldown = this.frontCooldownMax;
    this.markWeaponFired();
    const muzzleX = this.player.x + Math.cos(this.player.rotation) * 28;
    const muzzleY = this.player.y + Math.sin(this.player.rotation) * 28;
    this.createProjectile(
      'player',
      muzzleX,
      muzzleY,
      this.player.rotation,
      this.config.playerProjectileDamage * (powderBoost ? EXTRA_BALANCE.powerups.powderFrontDamageMultiplier : 1),
      powderBoost ? 0xff7ce8 : 0xffef8b,
      powderBoost ? EXTRA_BALANCE.powerups.powderProjectileSpeedMultiplier : 1,
    );
    this.kick(this.player, -5);
    this.playSound('front');
  }

  private fireBroadside(side: -1 | 1, manageCooldown = true): void {
    const powderBoost = this.powderTime > 0;
    this.markWeaponFired();
    if (manageCooldown) {
      this.broadsideCooldownMax = powderBoost
        ? this.config.frontCooldown * EXTRA_BALANCE.powerups.powderFrontCooldownMultiplier
        : this.config.broadsideCooldown;
      this.broadsideCooldown = this.broadsideCooldownMax;
    }
    const angle = this.player.rotation + side * Math.PI / 2;
    const sideOffset = 18;
    for (const offset of [-22, 0, 22]) {
      const ox = Math.cos(this.player.rotation) * offset + Math.cos(angle) * sideOffset;
      const oy = Math.sin(this.player.rotation) * offset + Math.sin(angle) * sideOffset;
      this.createProjectile(
        'player',
        this.player.x + ox,
        this.player.y + oy,
        angle,
        this.config.playerProjectileDamage * 0.8 * (powderBoost ? EXTRA_BALANCE.powerups.powderBroadsideDamageMultiplier : 1),
        powderBoost ? 0xff7ce8 : 0xfff08a,
        powderBoost ? EXTRA_BALANCE.powerups.powderProjectileSpeedMultiplier : 1,
      );
    }
    this.playSound('broadside');
    this.squashShip(this.player, side);
    this.shake(10, 0.2);
    this.spawnActionLines(this.player.x, this.player.y, angle, 0xffe066, 8);
    this.popLabel(engineText('broadside'), this.player.x, this.player.y - 56, 0xffe066, 0.55);
  }

  private createProjectile(owner: 'player' | 'enemy', x: number, y: number, angle: number, damage: number, tint: number, speedMultiplier = 1): void {
    const view = new Container();
    const shadow = new Graphics().ellipse(0, 7, 10, 4).fill({ color: 0x041827, alpha: 0.34 });
    const trail = new Graphics().roundRect(-28, -3, 28, 6, 3).fill({ color: tint, alpha: 0.33 });
    const glow = new Graphics().circle(0, 0, 13).fill({ color: tint, alpha: owner === 'player' ? 0.45 : 0.34 });
    const ball = new Sprite(Texture.from(GAME_ASSETS.cannonBall));
    ball.anchor.set(0.5);
    ball.scale.set(owner === 'player' ? 0.58 : 0.52);
    ball.tint = tint;
    view.addChild(shadow, trail, glow, ball);
    view.position.set(x, y);
    view.rotation = angle;
    this.world.addChild(view);
    const speed = this.config.projectileSpeed * (owner === 'enemy' ? 0.78 : speedMultiplier);
    const totalLifetime = this.config.projectileLifetime;
    this.projectiles.push({
      id: `shot-${this.elapsed.toFixed(3)}-${this.projectiles.length}`,
      owner,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 8,
      damage,
      lifetime: totalLifetime,
      totalLifetime,
      alive: true,
      view,
      ball,
      shadow,
      glow,
    });
    this.muzzleFlash(x, y, tint);
    this.cannonSmoke(x, y, angle);
    this.spawnSparkBurst(x, y, tint, owner === 'player' ? 5 : 3);
  }

  private removeProjectile(projectile: ProjectileEntity): void {
    if (!projectile.alive) return;
    projectile.alive = false; projectile.view.destroy({ children: true });
  }

  private choosePickupKind(healthRatio: number): PickupKind {
    if (healthRatio < 0.5 && this.rng.next() < 0.72) return 'medicine';
    const candidates: PickupKind[] = [];
    if (healthRatio < 0.94) candidates.push('medicine');
    if (this.powderTime <= 2.5) candidates.push('powder');
    if (this.windTime <= 2.5) candidates.push('wind');
    if (this.armorTime <= 2.5) candidates.push('armor');
    if (candidates.length > 0) return this.rng.pick(candidates);

    const remaining: { kind: PickupKind; time: number }[] = [
      { kind: 'powder', time: this.powderTime },
      { kind: 'wind', time: this.windTime },
      { kind: 'armor', time: this.armorTime },
    ];
    if (healthRatio < 0.9) remaining.push({ kind: 'medicine', time: 0 });
    remaining.sort((a, b) => a.time - b.time);
    return remaining[0]?.kind ?? 'powder';
  }

  private extendBuff(current: number, baseDuration: number): number {
    if (current <= 0) return baseDuration;
    const extended = current + baseDuration * EXTRA_BALANCE.adaptive.buffExtensionMultiplier;
    return Math.min(extended, baseDuration * EXTRA_BALANCE.adaptive.maxBuffDurationMultiplier);
  }

  private maybeSpawnSupportDrop(): void {
    if (this.supportClock < this.supportInterval || this.pickups.filter((pickup) => pickup.alive).length >= EXTRA_BALANCE.pickups.maxActive) return;
    const healthRatio = this.player.health / this.player.maxHealth;
    const needsSupport = this.pressure > 1.2 || healthRatio < 0.72;
    this.supportClock = 0;
    this.supportInterval = clamp((15.5 + this.rng.range(-2.2, 2.2)) / Math.pow(this.pressure, 0.68), 6.6, 19);
    if (!needsSupport) return;

    for (let attempt = 0; attempt < 18; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const distance = this.rng.range(125, 230);
      const x = clamp(this.player.x + Math.cos(angle) * distance, 72, WORLD_W - 72);
      const y = clamp(this.player.y + Math.sin(angle) * distance, 72, WORLD_H - 72);
      if (this.collidesIsland(x, y, 32)) continue;
      if (this.enemies.some((enemy) => enemy.alive && distSq(x, y, enemy.x, enemy.y) < 82 ** 2)) continue;
      const kind = this.choosePickupKind(healthRatio);
      this.spawnPickup(kind, x, y);
      this.popLabel(engineText('driftCrate'), x, y - 54, 0xfff08a, 0.7);
      return;
    }
  }

  private maybeDropPickup(x: number, y: number): void {
    if (!this.player.alive || this.pickups.filter((pickup) => pickup.alive).length >= EXTRA_BALANCE.pickups.maxActive) return;
    const healthRatio = this.player.health / this.player.maxHealth;
    const density = this.enemies.filter((enemy) => enemy.alive).length;
    const pressureBoost = Math.max(0, this.pressure - 1);
    const lowHealthBoost = Math.max(0, 0.72 - healthRatio) * 0.42;
    const densityBoost = clamp((density - 6) * 0.018, 0, 0.14);
    const calmPenalty = Math.max(0, 1 - this.pressure) * 0.05;
    const dropChance = clamp(0.13 - calmPenalty + pressureBoost * 0.14 + lowHealthBoost + densityBoost, 0.08, 0.66);
    if (this.rng.next() > dropChance) return;

    const kind = this.choosePickupKind(healthRatio);
    this.spawnPickup(kind, x, y);
  }

  private spawnPickup(kind: PickupKind, x: number, y: number): void {
    const view = new Container();
    const colors: Record<PickupKind, number> = {
      medicine: 0x7dff74,
      powder: 0xff6fd8,
      wind: 0x72edff,
      armor: 0xffd34d,
    };
    const color = colors[kind];
    const shadow = new Graphics().ellipse(0, 14, 27, 10).fill({ color: 0x032334, alpha: 0.28 });
    const ring = new Graphics().circle(0, 0, 25).stroke({ color: 0xffffff, width: 4, alpha: 0.88 });
    const halo = new Graphics().circle(0, 0, 31).stroke({ color, width: 7, alpha: 0.34 });
    halo.filters = [new BlurFilter({ strength: 5 })];
    const body = new Graphics().roundRect(-16, -16, 32, 32, 8).fill(color).stroke({ color: 0x071b36, width: 5 });
    const icon = new Graphics();
    if (kind === 'medicine') {
      icon.rect(-4, -11, 8, 22).fill(0xffffff).rect(-11, -4, 22, 8).fill(0xffffff);
    } else if (kind === 'powder') {
      icon.star(0, 0, 7, 11, 5).fill(0xffffff);
    } else if (kind === 'wind') {
      icon.moveTo(-12, -5).bezierCurveTo(-2, -14, 7, -8, 12, -2).stroke({ color: 0xffffff, width: 5 });
      icon.moveTo(-10, 5).bezierCurveTo(0, -1, 8, 2, 12, 8).stroke({ color: 0xffffff, width: 4 });
    } else {
      icon.poly([0, -12, 11, -5, 8, 9, 0, 13, -8, 9, -11, -5]).fill(0xffffff);
    }
    view.addChild(shadow, halo, ring, body, icon);
    view.position.set(x, y);
    this.world.addChild(view);
    this.pickups.push({
      id: `pickup-${kind}-${this.elapsed.toFixed(3)}-${this.pickups.length}`,
      kind,
      x,
      y,
      radius: 28,
      lifetime: clamp(EXTRA_BALANCE.pickups.baseLifetime + this.pressure * 1.45, 10, 13.5),
      alive: true,
      view,
    });
    this.popLabel(engineText(kind === 'medicine' ? 'supplies' : 'piratePower'), x, y - 42, color, 0.65);
  }

  private updatePickups(dt: number): void {
    for (const pickup of this.pickups) {
      if (!pickup.alive) continue;
      pickup.lifetime -= dt;
      pickup.view.y = pickup.y + Math.sin(this.elapsed * 5.5 + pickup.x * 0.01) * 4;
      pickup.view.rotation = Math.sin(this.elapsed * 2.8 + pickup.y * 0.01) * 0.08;
      const warning = pickup.lifetime < 2.4;
      pickup.view.alpha = warning ? 0.35 + (Math.sin(this.elapsed * 18) * 0.5 + 0.5) * 0.65 : 1;

      if (distSq(pickup.x, pickup.y, this.player.x, this.player.y) < (pickup.radius + this.player.radius + 6) ** 2) {
        this.collectPickup(pickup);
        continue;
      }
      if (pickup.lifetime <= 0) {
        pickup.alive = false;
        pickup.view.destroy({ children: true });
      }
    }
    this.pickups = this.pickups.filter((pickup) => pickup.alive);
  }

  private collectPickup(pickup: PickupEntity): void {
    if (!pickup.alive) return;
    pickup.alive = false;
    const buffDuration = clamp(EXTRA_BALANCE.pickups.baseBuffDuration + this.pressure * 1.25, 7.5, 10.2);
    if (pickup.kind === 'medicine') {
      const amount = Math.round(clamp(EXTRA_BALANCE.pickups.baseMedicine + this.pressure * 6.2, 22, 38));
      const before = this.player.health;
      this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
      const healed = Math.round(this.player.health - before);
      this.updateHealth(this.player);
      this.popLabel(engineText('medicine', { n: healed }), this.player.x, this.player.y - 58, 0x8cff7a, 0.75);
      this.showMechanicComicPanel('medicine', gameLines('medicine'));
    } else if (pickup.kind === 'powder') {
      this.powderTime = this.extendBuff(this.powderTime, buffDuration);
      this.popLabel(engineText('powderLive'), this.player.x, this.player.y - 58, 0xff70dd, 0.75);
      this.showMechanicComicPanel('powder', gameLines('powder'));
    } else if (pickup.kind === 'wind') {
      this.windTime = this.extendBuff(this.windTime, buffDuration);
      this.popLabel(engineText('wind'), this.player.x, this.player.y - 58, 0x78edff, 0.75);
      this.showMechanicComicPanel('wind', gameLines('wind'));
    } else {
      this.armorTime = this.extendBuff(this.armorTime, buffDuration);
      this.popLabel(engineText('armor'), this.player.x, this.player.y - 58, 0xffd75a, 0.75);
      this.showMechanicComicPanel('armor', gameLines('armor'));
    }
    this.spawnPickupBurst(pickup.x, pickup.y, pickup.kind);
    this.playSound('pickup');
    pickup.view.destroy({ children: true });
  }

  private damageShip(ship: ShipEntity, amount: number): void {
    if (!ship.alive) return;
    const armorActive = ship.id === PLAYER_ID && this.armorTime > 0;
    const effectiveAmount = armorActive ? amount * EXTRA_BALANCE.powerups.armorDamageMultiplier : amount;
    ship.health = Math.max(0, ship.health - effectiveAmount);
    if (ship.id === PLAYER_ID) {
      this.timeSincePlayerDamage = 0;
      this.resetIdlePopupCooldown();
      this.showDamageComicPanel(effectiveAmount);
      if (armorActive) this.popLabel(engineText('armorHeld'), ship.x, ship.y - 70, 0xffd75a, 0.42);
    }
    this.updateHealth(ship);
    ship.sprite.alpha = 0.22;
    ship.sprite.scale.set(ship.baseScale * 1.16, ship.baseScale * 0.84);
    ship.outline.scale.set(ship.baseScale * 1.28, ship.baseScale * 0.98);
    this.impactBurst(ship.x, ship.y);
    this.afterGameTime(0.09, () => {
      if (ship.alive) {
        ship.sprite.alpha = 1;
        ship.sprite.scale.set(ship.baseScale);
        ship.outline.scale.set(ship.baseScale * 1.17);
      }
    });
    this.popLabel(`-${Math.round(effectiveAmount)}`, ship.x, ship.y - 46, 0xffffff, 0.45);
    if (ship.health <= 0) {
      if (ship.id === PLAYER_ID) {
        ship.alive = false;
        this.explosion(ship.x, ship.y);
        // Player destruction always owns its explosion audio. This guarantees a
        // lethal cannonball has a proper final blast instead of ending on hit SFX only.
        this.playSound('explosion');
        this.finish('destroyed');
      } else {
        this.destroyEnemy(ship as EnemyEntity, true);
      }
    }
  }

  private pickDamagePanelPosition(panelW: number, panelH: number): { x: number; y: number; rotation: number } {
    const margin = 24;
    const safePaddingX = 136;
    const safePaddingY = 112;
    const minX = margin;
    const maxX = WORLD_W - panelW - margin;
    const minY = margin;
    const maxY = WORLD_H - panelH - margin;
    const reservedZones = [
      { x: 0, y: 0, w: 280, h: 110 },
      { x: WORLD_W - 280, y: 0, w: 280, h: 120 },
      { x: 0, y: WORLD_H - 120, w: 320, h: 120 },
      { x: WORLD_W - 320, y: WORLD_H - 126, w: 320, h: 126 },
      { x: WORLD_W / 2 - 150, y: WORLD_H - 108, w: 300, h: 96 },
    ];

    const intersectsRect = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    const overlapsPlayerSafetyZone = (x: number, y: number): boolean => {
      const safeLeft = this.player.x - safePaddingX;
      const safeRight = this.player.x + safePaddingX;
      const safeTop = this.player.y - safePaddingY;
      const safeBottom = this.player.y + safePaddingY;
      return intersectsRect(x, y, panelW, panelH, safeLeft, safeTop, safeRight - safeLeft, safeBottom - safeTop);
    };

    const overlapsEnemyZone = (x: number, y: number): boolean => this.enemies.some((enemy) => enemy.alive && intersectsRect(x, y, panelW, panelH, enemy.x - 68, enemy.y - 68, 136, 136));
    const overlapsExistingPanel = (x: number, y: number): boolean => this.activeComicPanels.some((entry) => !entry.panel.destroyed && intersectsRect(x, y, panelW, panelH, entry.panel.x - 12, entry.panel.y - 12, panelW + 24, panelH + 24));
    const overlapsReserved = (x: number, y: number): boolean => reservedZones.some((zone) => intersectsRect(x, y, panelW, panelH, zone.x, zone.y, zone.w, zone.h));

    const scoreCandidate = (x: number, y: number): number => {
      const cx = x + panelW / 2;
      const cy = y + panelH / 2;
      let score = distSq(cx, cy, this.player.x, this.player.y);
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        score += Math.min(180000, distSq(cx, cy, enemy.x, enemy.y) * 0.48);
      }
      if (overlapsReserved(x, y)) score -= 180000;
      if (overlapsExistingPanel(x, y)) score -= 120000;
      return score;
    };

    const candidates: { x: number; y: number }[] = [];
    const randomInterior = () => ({ x: this.uiRng.range(minX, maxX), y: this.uiRng.range(minY, maxY) });
    const randomEdge = () => {
      const side = this.uiRng.int(0, 3);
      if (side === 0) return { x: this.uiRng.range(minX, maxX), y: minY };
      if (side === 1) return { x: this.uiRng.range(minX, maxX), y: maxY };
      if (side === 2) return { x: minX, y: this.uiRng.range(minY, maxY) };
      return { x: maxX, y: this.uiRng.range(minY, maxY) };
    };

    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = this.uiRng.next() < 0.62 ? randomEdge() : randomInterior();
      if (!overlapsPlayerSafetyZone(candidate.x, candidate.y) && !overlapsEnemyZone(candidate.x, candidate.y) && !overlapsReserved(candidate.x, candidate.y) && !overlapsExistingPanel(candidate.x, candidate.y)) {
        return { x: candidate.x, y: candidate.y, rotation: 0 };
      }
      candidates.push(candidate);
    }

    const fallbacks = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: minX, y: maxY },
      { x: maxX, y: maxY },
      { x: (WORLD_W - panelW) / 2, y: minY },
      { x: (WORLD_W - panelW) / 2, y: maxY },
      { x: minX, y: (WORLD_H - panelH) / 2 },
      { x: maxX, y: (WORLD_H - panelH) / 2 },
    ];
    candidates.push(...fallbacks);

    const best = candidates.reduce((currentBest, candidate) => scoreCandidate(candidate.x, candidate.y) > scoreCandidate(currentBest.x, currentBest.y) ? candidate : currentBest, candidates[0] ?? { x: minX, y: minY });
    return { x: best.x, y: best.y, rotation: 0 };
  }


  private hasActivePanelKind(kind: ComicPanelKind): boolean {
    return this.activeComicPanels.some((entry) => entry.kind === kind && !entry.panel.destroyed);
  }


  private resetIdlePopupCooldown(): void {
    this.idlePopupCooldown = this.uiRng.range(2.4, 4.1);
  }

  private markPlayerOffense(): void {
    // Idle reactions are meant for genuinely idle moments. Every successful
    // offensive hit restarts the idle window, even when the target survives.
    this.timeSincePlayerOffense = 0;
    this.resetIdlePopupCooldown();
  }

  private maybeShowIdleComicPanel(dt: number): void {
    if (!this.player?.alive || this.ended || this.paused) return;

    const calmEnough = this.timeSincePlayerDamage >= 1.7
      && this.timeSincePlayerVictory >= 1.5
      && this.timeSincePlayerOffense >= 1.5;

    // Crucially, the idle timer itself does not tick while combat is active.
    // Once the captain stops taking/dealing damage or scoring kills, a fresh
    // full idle countdown is allowed to run.
    if (!calmEnough) return;

    this.idlePopupCooldown = Math.max(0, this.idlePopupCooldown - dt);
    if (this.idlePopupCooldown > 0 || this.hasActivePanelKind('idle')) return;
    this.showIdleComicPanel();
    this.resetIdlePopupCooldown();
  }

  private pickPortraitPath(kind: 'damage' | 'victory'): string {
    const portraits = kind === 'damage' ? GAME_ASSETS.damagePortraits : GAME_ASSETS.victoryPortraits;
    const lastIndex = kind === 'damage' ? this.lastDamagePortraitIndex : this.lastVictoryPortraitIndex;
    const choices = portraits
      .map((path, index) => ({ path, index }))
      .filter(({ index }) => index !== lastIndex);
    const next = choices.length > 0 ? this.uiRng.pick(choices) : { path: portraits[0]!, index: 0 };
    if (kind === 'damage') this.lastDamagePortraitIndex = next.index;
    else this.lastVictoryPortraitIndex = next.index;
    return next.path;
  }

  private pickIdleComicScript(): IdleComicScript {
    const scripts: IdleComicScript[] = GAME_ASSETS.idlePortraits.map((portraitPath, index) => ({
      portraitPath,
      lines: idleLineGroup(index),
    }));

    const choices = scripts.filter((_, index) => index !== this.lastIdlePortraitIndex);
    const next = choices.length > 0 ? this.uiRng.pick(choices) : scripts[0]!;
    const portraitIndex = GAME_ASSETS.idlePortraits.findIndex((path) => path === next.portraitPath);
    this.lastIdlePortraitIndex = portraitIndex >= 0 ? portraitIndex : 0;
    const lineChoices = next.lines.filter((line) => line !== this.lastIdleLine);
    const line = lineChoices.length > 0 ? this.uiRng.pick(lineChoices) : next.lines[0]!;
    this.lastIdleLine = line;
    return { portraitPath: next.portraitPath, lines: [line] };
  }

  private pickDamageLine(): string {
    const standard = gameLines('damageStandard');
    const rare = gameLines('damageRare');
    return this.uiRng.next() < 0.12 ? this.uiRng.pick(rare) : this.uiRng.pick(standard);
  }

  private pickVictoryLine(enemyKind: 'chaser' | 'shooter', streak: number): string {
    const special = gameLines('victorySpecial');
    const combo2 = gameLines('victoryCombo2');
    const combo3 = gameLines('victoryCombo3');
    const comboHigh = [engineText('comboScore', { n: Math.max(4, streak) }), ...gameLines('victoryComboHigh')];
    const chaserLines = gameLines('victoryChaser');
    const shooterLines = gameLines('victoryShooter');
    const generic = gameLines('victoryGeneric');

    if (this.uiRng.next() < 0.1) return this.uiRng.pick(special);
    if (streak >= 4) return this.uiRng.pick(comboHigh);
    if (streak >= 3) return this.uiRng.pick(combo3);
    if (streak >= 2) return this.uiRng.pick(combo2);
    const pool = enemyKind === 'chaser' ? [...chaserLines, ...generic] : [...shooterLines, ...generic];
    return this.uiRng.pick(pool);
  }

  private buildVictoryStyle(streak: number): { accent: number; burstFill: number; headerText: string; badgeText: string } {
    if (streak >= 5) {
      return { accent: 0xb145ff, burstFill: 0xfff178, headerText: engineText('massacre'), badgeText: `x${streak}` };
    }
    if (streak >= 3) {
      return { accent: 0xff9a2f, burstFill: 0xfff39a, headerText: engineText('comboPirate'), badgeText: `x${streak}` };
    }
    if (streak >= 2) {
      return { accent: 0x27c7ff, burstFill: 0xfff39a, headerText: engineText('sequence'), badgeText: `x${streak}` };
    }
    return { accent: 0x41d95c, burstFill: 0xfff39a, headerText: engineText('shipDown'), badgeText: '+1' };
  }

  private showComicPanel(
    kind: ComicPanelKind,
    options?: ComicPanelOptions,
  ): void {
    if (!this.initialized || this.destroyed) return;

    const idleScript = kind === 'idle' && !options?.portraitPath ? this.pickIdleComicScript() : null;
    let portraitPath = options?.portraitPath;
    if (!portraitPath && kind === 'idle') portraitPath = idleScript!.portraitPath;
    if (!portraitPath && (kind === 'damage' || kind === 'victory')) portraitPath = this.pickPortraitPath(kind);
    if (!portraitPath) return;
    const portraitTexture = Texture.from(portraitPath);
    const sourceWidth = Math.max(1, portraitTexture.width || 1);
    const sourceHeight = Math.max(1, portraitTexture.height || 1);
    const aspect = sourceWidth / sourceHeight;
    const portraitW = 216;
    const portraitH = clamp(portraitW / aspect, 150, 216);
    const panelW = 244;
    const panelH = portraitH + 36;
    const placement = this.pickDamagePanelPosition(panelW, panelH);
    const panel = new Container();
    panel.position.set(placement.x, placement.y);
    panel.rotation = placement.rotation;
    panel.alpha = 0;
    panel.scale.set(1);

    const victoryStyle = kind === 'victory' ? this.buildVictoryStyle(options?.streak ?? 1) : null;
    const accent = options?.accent ?? (kind === 'damage' ? 0xff3152 : kind === 'victory' ? victoryStyle!.accent : 0x27c7ff);
    const burstFill = options?.burstFill ?? (kind === 'damage' ? 0xffe44f : kind === 'victory' ? victoryStyle!.burstFill : 0xfff39a);
    const headerText = options?.headerText ?? (kind === 'damage'
      ? engineText('damageHeader')
      : kind === 'victory'
        ? victoryStyle!.headerText
        : engineText('idleHeader'));
    const badgeText = options?.badgeText ?? (kind === 'damage'
      ? `-${Math.round(options?.value ?? 0)}`
      : kind === 'victory'
        ? victoryStyle!.badgeText
        : '...');
    const line = options?.line
      ?? (kind === 'damage'
        ? this.pickDamageLine()
        : kind === 'victory'
          ? this.pickVictoryLine(options?.enemyKind ?? 'shooter', options?.streak ?? 1)
          : idleScript!.lines[0]!);

    const shadow = new Graphics()
      .poly([10, 12, panelW, 5, panelW - 6, panelH - 12, 2, panelH])
      .fill({ color: 0x071b36, alpha: 0.92 });
    shadow.position.set(8, 10);

    const frameStroke = options?.frameStroke ?? (kind === 'victory' && (options?.streak ?? 1) >= 3 ? accent : kind === 'idle' ? 0x0f4c81 : 0x071b36);
    const frame = new Graphics()
      .poly([4, 3, panelW - 8, 0, panelW - 12, panelH - 18, 0, panelH - 10])
      .fill(0xfff2ca)
      .stroke({ color: frameStroke, width: 7 });

    const portrait = new Sprite(portraitTexture);
    portrait.position.set(10, 8);
    portrait.width = portraitW;
    portrait.height = portraitH;

    const wash = new Graphics()
      .rect(10, 8, portraitW, portraitH)
      .fill({ color: accent, alpha: kind === 'damage' ? 0.05 : (kind === 'idle' || kind === 'mechanic') ? 0.03 : 0.04 });

    const phraseY = 8 + portraitH - 28;
    const phraseBack = new Graphics()
      .roundRect(12, phraseY, 208, 36, 4)
      .fill(accent)
      .stroke({ color: 0x071b36, width: 4 });
    phraseBack.rotation = -0.02;

    const phrase = new Text({
      text: line,
      style: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: 17,
        fontWeight: '900',
        fill: 0xffffff,
        stroke: { color: 0x071b36, width: 4 },
        align: 'center',
        letterSpacing: 0.6,
      },
    });
    phrase.anchor.set(0.5, 0.5);
    phrase.position.set(116, phraseY + 18);
    phrase.rotation = -0.02;

    const headerBack = new Graphics()
      .roundRect(10, 10, 154, 24, 3)
      .fill({ color: 0x071b36, alpha: 0.82 });
    const header = new Text({
      text: headerText,
      style: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: 12,
        fontWeight: '900',
        fill: 0xffffff,
        letterSpacing: 0.7,
      },
    });
    header.position.set(18, 15);

    const badge = new Text({
      text: badgeText,
      style: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: (kind === 'idle' || kind === 'mechanic') ? 26 : 30,
        fontWeight: '900',
        fill: burstFill,
        stroke: { color: 0x071b36, width: (kind === 'idle' || kind === 'mechanic') ? 5 : 6 },
      },
    });
    badge.anchor.set(1, 0);
    badge.position.set(panelW - 18, 12);
    badge.rotation = 0.04;

    panel.addChild(shadow, frame, portrait, wash, phraseBack, phrase, headerBack, header, badge);
    this.uiFx.addChild(panel);

    const baseX = placement.x;
    const baseY = placement.y;
    const baseRotation = placement.rotation;
    let life = kind === 'damage' ? 1.08 : kind === 'victory' ? 1.06 : 1.18;
    const total = life;
    const update = (ticker: { deltaMS: number }) => {
      const dt = ticker.deltaMS / 1000;
      life -= dt;
      const elapsed = total - life;

      if (elapsed < 0.12) {
        const p = elapsed / 0.12;
        panel.alpha = p;
        panel.x = baseX - (1 - p) * 16;
        panel.y = baseY + (1 - p) * 8;
      } else if (elapsed < 0.36) {
        panel.alpha = 1;
        const amp = Math.max(0, 1 - (elapsed - 0.12) / 0.24) * 5;
        panel.x = baseX + Math.sin(elapsed * 92) * amp;
        panel.y = baseY + Math.cos(elapsed * 78) * amp * 0.55;
      } else if (life < 0.22) {
        const p = Math.max(0, life / 0.22);
        panel.alpha = p;
        panel.x = baseX;
        panel.y = baseY + (1 - p) * 9;
      } else {
        panel.alpha = 1;
        panel.position.set(baseX, baseY);
      }
      panel.rotation = baseRotation;

      if (life <= 0) {
        this.app.ticker.remove(update);
        this.activeComicPanels = this.activeComicPanels.filter((entry) => entry.panel !== panel);
        if (!panel.destroyed) panel.destroy({ children: true });
      }
    };

    // Panels are intentionally independent: only their own lifetime removes them.
    this.activeComicPanels.push({ kind, panel, update });
    this.app.ticker.add(update);
  }

  private showDamageComicPanel(amount: number): void {
    this.showComicPanel('damage', { value: amount, line: this.pickDamageLine() });
  }

  private showVictoryComicPanel(enemyKind: 'chaser' | 'shooter', streak: number): void {
    this.showComicPanel('victory', { value: 1, enemyKind, streak, line: this.pickVictoryLine(enemyKind, streak) });
  }

  private showIdleComicPanel(): void {
    this.showComicPanel('idle');
    this.playIdleChirp();
  }

  private showIdleComicPanelWithLine(line: string): void {
    this.showComicPanel('idle', { line });
    this.playIdleChirp();
  }

  private showMechanicComicPanel(kind: MechanicReactKind, lines: string[]): void {
    const presets: Record<MechanicReactKind, { portraitPath: string; accent: number; burstFill: number; headerText: string; badgeText: string; frameStroke: number }> = {
      dash: {
        portraitPath: GAME_ASSETS.mechanicPortraits.dash,
        accent: 0x9b59ff,
        burstFill: 0xfff3ff,
        headerText: engineText('dashHeader'),
        badgeText: '>>',
        frameStroke: 0x5e2bb8,
      },
      medicine: {
        portraitPath: GAME_ASSETS.mechanicPortraits.medicine,
        accent: 0xff69b4,
        burstFill: 0xfff0bf,
        headerText: engineText('repairHeader'),
        badgeText: engineText('hullBadge'),
        frameStroke: 0xb93072,
      },
      powder: {
        portraitPath: GAME_ASSETS.mechanicPortraits.powder,
        accent: 0xffd23f,
        burstFill: 0xffffd0,
        headerText: engineText('powderHeader'),
        badgeText: engineText('powderBadge'),
        frameStroke: 0xc08e00,
      },
      wind: {
        portraitPath: GAME_ASSETS.mechanicPortraits.wind,
        accent: 0x18b7a0,
        burstFill: 0xe7fff6,
        headerText: engineText('windHeader'),
        badgeText: engineText('sailBadge'),
        frameStroke: 0x0c6d60,
      },
      armor: {
        portraitPath: GAME_ASSETS.mechanicPortraits.armor,
        accent: 0x3f6387,
        burstFill: 0xf6efbf,
        headerText: engineText('armorHeader'),
        badgeText: engineText('armorBadge'),
        frameStroke: 0x243e56,
      },
      barrel: {
        portraitPath: GAME_ASSETS.mechanicPortraits.barrel,
        accent: 0xff8a32,
        burstFill: 0xfff0c9,
        headerText: engineText('barrelHeader'),
        badgeText: engineText('barrelBadge'),
        frameStroke: 0xb35612,
      },
    };

    const preset = presets[kind];
    const line = this.uiRng.pick(lines);
    this.showComicPanel('mechanic', {
      line,
      portraitPath: preset.portraitPath,
      accent: preset.accent,
      burstFill: preset.burstFill,
      headerText: preset.headerText,
      badgeText: preset.badgeText,
      frameStroke: preset.frameStroke,
    });
    this.playIdleChirp();
  }

  private destroyEnemy(enemy: EnemyEntity, awardPoint: boolean, playExplosionAudio = true): void {
    if (!enemy.alive) return;
    enemy.alive = false;
    if (awardPoint) {
      this.score += 1;
      this.streak = this.streakClock > 0 ? this.streak + 1 : 1;
      this.streakClock = 2.25;
      this.timeSincePlayerVictory = 0;
      this.resetIdlePopupCooldown();
      this.popLabel(this.streak >= 3 ? engineText('chaosScore', { n: this.streak }) : '+1', enemy.x, enemy.y - 48, 0xfff16b, 0.8);
      this.showVictoryComicPanel(enemy.kind, this.streak);
      this.maybeDropPickup(enemy.x, enemy.y);
    }
    this.spawnActionLines(enemy.x, enemy.y, this.uiRng.range(0, Math.PI * 2), enemy.kind === 'chaser' ? 0xff6b66 : 0xd978ff, 7);
    this.explosion(enemy.x, enemy.y);
    enemy.view.destroy({ children: true });
    if (playExplosionAudio) this.playSound('explosion');
  }

  private updateHealth(ship: ShipEntity): void {
    const pct = ship.health / ship.maxHealth;
    ship.healthBack.clear().roundRect(-30, -46, 60, 8, 4).fill({ color: 0x071b36, alpha: 0.9 });
    ship.healthFill.clear().roundRect(-29, -45, 58 * pct, 6, 3).fill(pct > 0.5 ? 0x7dff74 : pct > 0.25 ? 0xffd84d : 0xff4e68);
    const damageLevel = pct <= 0.25 ? 1 : pct <= 0.5 ? 0.62 : 0;
    ship.damageFx.alpha = damageLevel > 0 ? 0.68 + damageLevel * 0.2 : 0;
    ship.damageFx.scale.set(pct <= 0.25 ? 0.92 : 0.72);
    if (ship.damageGlow) ship.damageGlow.alpha = damageLevel > 0 ? 0.34 + damageLevel * 0.18 : 0;
    if (ship.id === PLAYER_ID) ship.sprite.tint = pct < 0.35 ? 0xffa5a7 : 0xffdf59;
  }

  private animateShipDamageFx(ship: ShipEntity): void {
    if (!ship.alive) return;
    if (ship.damageFx.alpha <= 0.001) {
      ship.damageFx.rotation = 0;
      if (ship.damageGlow) {
        ship.damageGlow.scale.set(1);
      }
      return;
    }
    const pulse = Math.sin(this.elapsed * 12 + ship.x * 0.011 + ship.y * 0.009) * 0.5 + 0.5;
    ship.damageFx.rotation = (pulse - 0.5) * 0.22;
    ship.damageFx.y = -20 + pulse * 2.4;
    const flameBase = ship.health / ship.maxHealth <= 0.25 ? 0.9 : 0.72;
    ship.damageFx.scale.set(flameBase + pulse * 0.12, flameBase + pulse * 0.2);
    if (ship.damageGlow) {
      ship.damageGlow.scale.set(0.94 + pulse * 0.22, 0.9 + pulse * 0.14);
      ship.damageGlow.position.y = -14 + pulse * 1.6;
    }
  }

  private afterGameTime(seconds: number, callback: () => void): void {
    let remaining = seconds;
    const update = (ticker: { deltaMS: number }) => {
      remaining -= ticker.deltaMS / 1000;
      if (remaining > 0) return;
      this.app.ticker.remove(update);
      if (!this.destroyed) callback();
    };
    this.app.ticker.add(update);
  }

  private spawnWake(): void {
    const backX = this.player.x - Math.cos(this.player.rotation) * 32;
    const backY = this.player.y - Math.sin(this.player.rotation) * 32;
    for (const side of [-1, 1]) {
      const foam = new Graphics().circle(0, 0, this.uiRng.range(4, 8)).fill({ color: 0xe7fff8, alpha: 0.74 });
      const sideAngle = this.player.rotation + Math.PI / 2;
      foam.position.set(backX + Math.cos(sideAngle) * side * 10, backY + Math.sin(sideAngle) * side * 10);
      this.world.addChild(foam);
      let life = 0.42;
      const update = (ticker: { deltaMS: number }) => {
        const dt = ticker.deltaMS / 1000; life -= dt; foam.scale.set(1 + (0.42 - life) * 2.4); foam.alpha = Math.max(0, life / 0.42) * 0.74;
        if (life <= 0) { this.app.ticker.remove(update); foam.destroy(); }
      };
      this.app.ticker.add(update);
    }
  }

  private spawnSparkBurst(x: number, y: number, color: number, count: number): void {
    const budget = Math.max(0, 120 - this.visualParticleCount);
    const actual = Math.min(count, budget);
    for (let i = 0; i < actual; i++) {
      this.visualParticleCount += 1;
      const spark = new Graphics().roundRect(-3, -2, 8, 4, 2).fill({ color, alpha: 0.95 });
      spark.position.set(x, y);
      spark.rotation = this.uiRng.range(0, Math.PI * 2);
      this.fx.addChild(spark);
      const angle = this.uiRng.range(0, Math.PI * 2);
      const speed = this.uiRng.range(55, 145);
      let life = this.uiRng.range(0.14, 0.3);
      const full = life;
      const update = (ticker: { deltaMS: number }) => {
        const dt = ticker.deltaMS / 1000;
        life -= dt;
        spark.x += Math.cos(angle) * speed * dt;
        spark.y += Math.sin(angle) * speed * dt;
        spark.rotation += dt * 8;
        spark.alpha = Math.max(0, life / full);
        spark.scale.set(0.65 + life / full * 0.55);
        if (life <= 0) {
          this.app.ticker.remove(update);
          this.visualParticleCount = Math.max(0, this.visualParticleCount - 1);
          spark.destroy();
        }
      };
      this.app.ticker.add(update);
    }
  }

  private spawnActionLines(x: number, y: number, heading: number, color: number, count: number): void {
    const budget = Math.max(0, 120 - this.visualParticleCount);
    const actual = Math.min(count, budget);
    for (let i = 0; i < actual; i++) {
      this.visualParticleCount += 1;
      const angle = heading + this.uiRng.range(-0.92, 0.92);
      const distance = this.uiRng.range(42, 105);
      const length = this.uiRng.range(28, 72);
      const line = new Graphics()
        .roundRect(-length, -2, length, this.uiRng.range(3, 6), 2)
        .fill({ color: i % 3 === 0 ? 0xffffff : color, alpha: this.uiRng.range(0.45, 0.82) });
      line.position.set(x - Math.cos(angle) * distance, y - Math.sin(angle) * distance);
      line.rotation = angle;
      this.fx.addChild(line);
      let life = this.uiRng.range(0.12, 0.24);
      const full = life;
      const speed = this.uiRng.range(90, 185);
      const update = (ticker: { deltaMS: number }) => {
        const dt = ticker.deltaMS / 1000;
        life -= dt;
        line.x -= Math.cos(angle) * speed * dt;
        line.y -= Math.sin(angle) * speed * dt;
        line.scale.x = 0.85 + (full - life) * 4.5;
        line.alpha = Math.max(0, life / full) * 0.82;
        if (life <= 0) {
          this.app.ticker.remove(update);
          this.visualParticleCount = Math.max(0, this.visualParticleCount - 1);
          line.destroy();
        }
      };
      this.app.ticker.add(update);
    }
  }

  private spawnDashWake(startX: number, startY: number, endX: number, endY: number): void {
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;
    const sideX = -ny;
    const sideY = nx;
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = startX + dx * t + sideX * this.uiRng.range(-12, 12);
      const y = startY + dy * t + sideY * this.uiRng.range(-12, 12);
      const streak = new Graphics().roundRect(-18, -3, 36, 6, 3).fill({ color: i % 2 ? 0xffffff : 0x78efff, alpha: 0.62 });
      streak.position.set(x, y);
      streak.rotation = Math.atan2(ny, nx);
      this.fx.addChild(streak);
      let life = 0.24 + i * 0.018;
      const full = life;
      const update = (ticker: { deltaMS: number }) => {
        life -= ticker.deltaMS / 1000;
        streak.alpha = Math.max(0, life / full) * 0.62;
        streak.scale.x = 1 + (full - life) * 2.4;
        if (life <= 0) {
          this.app.ticker.remove(update);
          streak.destroy();
        }
      };
      this.app.ticker.add(update);
    }
    this.spawnSparkBurst(endX, endY, 0xb6fff5, 8);
  }

  private spawnPickupBurst(x: number, y: number, kind: PickupKind): void {
    const color: Record<PickupKind, number> = {
      medicine: 0x7dff74,
      powder: 0xff6fd8,
      wind: 0x72edff,
      armor: 0xffd34d,
    };
    const ring = new Graphics().circle(0, 0, 18).stroke({ color: color[kind], width: 7, alpha: 0.88 });
    ring.position.set(x, y);
    this.fx.addChild(ring);
    let life = 0.42;
    const update = (ticker: { deltaMS: number }) => {
      life -= ticker.deltaMS / 1000;
      const p = 1 - Math.max(0, life / 0.42);
      ring.scale.set(1 + p * 2.8);
      ring.alpha = Math.max(0, life / 0.42);
      if (life <= 0) {
        this.app.ticker.remove(update);
        ring.destroy();
      }
    };
    this.app.ticker.add(update);
    this.spawnSparkBurst(x, y, color[kind], 10);
  }

  private aimFlash(x: number, y: number, tx: number, ty: number): void {
    const line = new Graphics().moveTo(x, y).lineTo(tx, ty).stroke({ color: 0xff72d0, width: 3, alpha: 0.72 });
    this.fx.addChild(line);
    let life = 0.28;
    const update = (ticker: { deltaMS: number }) => {
      life -= ticker.deltaMS / 1000; line.alpha = Math.max(0, life / 0.28);
      if (life <= 0) { this.app.ticker.remove(update); line.destroy(); }
    };
    this.app.ticker.add(update);
  }

  private impactBurst(x: number, y: number): void {
    const burst = new Graphics().star(0, 0, 12, 25, 8).fill({ color: 0xffffff, alpha: 0.88 });
    burst.position.set(x, y); burst.rotation = this.uiRng.range(0, Math.PI); this.fx.addChild(burst);
    let life = 0.16;
    const update = (ticker: { deltaMS: number }) => {
      life -= ticker.deltaMS / 1000; burst.scale.set(0.7 + (0.16 - life) * 5); burst.alpha = Math.max(0, life / 0.16);
      if (life <= 0) { this.app.ticker.remove(update); burst.destroy(); }
    };
    this.app.ticker.add(update);
  }

  private squashShip(ship: ShipEntity, side: -1 | 1): void {
    ship.sprite.scale.set(ship.baseScale * 1.18, ship.baseScale * 0.78);
    ship.sprite.x = side * -7;
    ship.outline.scale.set(ship.baseScale * 1.31, ship.baseScale * 0.92);
    ship.outline.x = side * -7;
    this.afterGameTime(0.095, () => {
      if (!ship.sprite.destroyed) { ship.sprite.scale.set(ship.baseScale); ship.sprite.x = 0; }
      if (!ship.outline.destroyed) { ship.outline.scale.set(ship.baseScale * 1.17); ship.outline.x = 0; }
    });
  }

  private cannonSmoke(x: number, y: number, angle: number): void {
    for (let i = 0; i < 3; i++) {
      const puff = new Graphics().circle(0, 0, this.uiRng.range(5, 10)).fill({ color: 0xe9fff8, alpha: this.uiRng.range(0.2, 0.46) });
      puff.position.set(x + this.uiRng.range(-5, 5), y + this.uiRng.range(-5, 5));
      this.fx.addChild(puff);
      let life = this.uiRng.range(0.28, 0.48); const full = life; const drift = this.uiRng.range(14, 30);
      const update = (ticker: { deltaMS: number }) => {
        const dt = ticker.deltaMS / 1000; life -= dt;
        puff.x -= Math.cos(angle) * drift * dt; puff.y -= Math.sin(angle) * drift * dt;
        puff.scale.set(1 + (full - life) * 2.2); puff.alpha = Math.max(0, life / full) * 0.42;
        if (life <= 0) { this.app.ticker.remove(update); puff.destroy(); }
      };
      this.app.ticker.add(update);
    }
  }

  private muzzleFlash(x: number, y: number, color: number): void {
    const flash = new Graphics().star(0, 0, 8, 18, 4).fill({ color, alpha: 0.95 });
    flash.position.set(x, y); this.fx.addChild(flash);
    let life = 0.15;
    const update = (ticker: { deltaMS: number }) => {
      life -= ticker.deltaMS / 1000; flash.scale.set(1 + (0.15 - life) * 4); flash.alpha = Math.max(0, life / 0.15);
      if (life <= 0) { this.app.ticker.remove(update); flash.destroy(); }
    };
    this.app.ticker.add(update);
  }

  private explosion(x: number, y: number): void {
    const sprite = new Sprite(Texture.from(GAME_ASSETS.explosion));
    sprite.anchor.set(0.5); sprite.position.set(x, y); sprite.scale.set(0.25); this.fx.addChild(sprite);
    const ring = new Graphics().circle(0, 0, 16).stroke({ color: 0xffef82, width: 8, alpha: 0.85 }); ring.position.set(x, y); this.fx.addChild(ring);
    let life = 0.42;
    const update = (ticker: { deltaMS: number }) => {
      const dt = ticker.deltaMS / 1000; life -= dt; const p = 1 - Math.max(0, life / 0.42);
      sprite.scale.set(0.25 + p * 1.5); sprite.alpha = Math.max(0, life / 0.42);
      ring.scale.set(1 + p * 3); ring.alpha = Math.max(0, life / 0.42);
      if (life <= 0) { this.app.ticker.remove(update); sprite.destroy(); ring.destroy(); }
    };
    this.app.ticker.add(update);
    for (let i = 0; i < 7; i++) {
      const debris = new Graphics().rect(-3, -3, 6, 6).fill(i % 2 ? 0xffe45a : 0xff5964);
      debris.position.set(x, y); debris.rotation = this.uiRng.range(0, Math.PI); this.fx.addChild(debris);
      const a = this.uiRng.range(0, Math.PI * 2); const speed = this.uiRng.range(70, 170); let debrisLife = this.uiRng.range(0.3, 0.56); const full = debrisLife;
      const debrisUpdate = (ticker: { deltaMS: number }) => {
        const dt = ticker.deltaMS / 1000; debrisLife -= dt; debris.x += Math.cos(a) * speed * dt; debris.y += Math.sin(a) * speed * dt; debris.rotation += dt * 8; debris.alpha = Math.max(0, debrisLife / full);
        if (debrisLife <= 0) { this.app.ticker.remove(debrisUpdate); debris.destroy(); }
      };
      this.app.ticker.add(debrisUpdate);
    }
    this.shake(9, 0.2);
  }

  private popLabel(text: string, x: number, y: number, color: number, duration: number): void {
    const label = new Text({ text, style: { fontFamily: 'Impact, Arial Black, sans-serif', fontSize: 24, fontWeight: '900', fill: color, stroke: { color: 0x071b36, width: 6 }, letterSpacing: 1 } });
    label.anchor.set(0.5);
    label.position.set(clamp(x, 96, WORLD_W - 96), clamp(y, 62, WORLD_H - 42));
    label.rotation = this.uiRng.range(-0.06, 0.06);
    this.fx.addChild(label);
    let life = duration;
    const update = (ticker: { deltaMS: number }) => {
      const dt = ticker.deltaMS / 1000; life -= dt; label.y -= 28 * dt; label.scale.set(1 + (duration - life) * 0.18); label.alpha = Math.max(0, Math.min(1, life * 3));
      if (life <= 0) { this.app.ticker.remove(update); label.destroy(); }
    };
    this.app.ticker.add(update);
  }

  private kick(ship: ShipEntity, amount: number): void {
    ship.sprite.y = amount; ship.outline.y = amount;
    ship.sprite.scale.set(ship.baseScale * 0.86, ship.baseScale * 1.12);
    this.afterGameTime(0.072, () => {
      if (!ship.sprite.destroyed) { ship.sprite.y = 0; ship.sprite.scale.set(ship.baseScale); }
      if (!ship.outline.destroyed) ship.outline.y = 0;
    });
  }

  private shake(amount: number, duration: number): void {
    let life = duration;
    const update = (ticker: { deltaMS: number }) => {
      life -= ticker.deltaMS / 1000;
      if (life > 0) this.root.position.set(this.uiRng.range(-amount, amount), this.uiRng.range(-amount, amount));
      else { this.root.position.set(0, 0); this.app.ticker.remove(update); }
    };
    this.app.ticker.add(update);
  }

  private playProjectileHitSound(): void {
    this.playSound(this.uiRng.next() < 0.5 ? 'hit1' : 'hit2');
  }

  private playShipContactSound(): void {
    if (this.shipContactSoundCooldown > 0) return;
    this.shipContactSoundCooldown = 0.38;
    this.playSound('collision');
  }

  private playSound(key: string): void {
    if (isSfxMuted()) return;
    const original = this.audio.get(key); if (!original) return;
    const sound = original.cloneNode() as HTMLAudioElement; sound.volume = original.volume; void sound.play().catch(() => undefined);
  }

  private playIdleChirp(): void {
    if (isSfxMuted()) return;
    const original = this.audio.get('idleChirp');
    if (!original) return;
    const sound = original.cloneNode() as HTMLAudioElement;
    sound.volume = original.volume;
    sound.playbackRate = this.uiRng.range(0.94, 1.08);
    void sound.play().catch(() => undefined);
  }

  private emitSnapshot(force: boolean): void {
    if (!force && this.elapsed - this.lastSnapshotAt < 0.08) return;
    this.lastSnapshotAt = this.elapsed;
    this.callbacks.onSnapshot({
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      score: this.score,
      timeLeft: Math.max(0, this.config.sessionTime - this.elapsed),
      paused: this.paused,
      streak: this.streak,
      enemyCount: this.enemies.filter((enemy) => enemy.alive).length,
      entityCount: this.enemies.filter((enemy) => enemy.alive).length + this.projectiles.length + this.pickups.length + this.powderBarrels.filter((barrel) => barrel.alive).length + 1,
      frontReload: this.frontCooldown <= 0 ? 1 : clamp(1 - this.frontCooldown / Math.max(0.001, this.frontCooldownMax), 0, 1),
      broadsideReload: this.broadsideCooldown <= 0 ? 1 : clamp(1 - this.broadsideCooldown / Math.max(0.001, this.broadsideCooldownMax), 0, 1),
      dashReload: this.dashCooldown <= 0 ? 1 : clamp(1 - this.dashCooldown / Math.max(0.001, this.dashCooldownMax), 0, 1),
      powderTime: this.powderTime,
      windTime: this.windTime,
      armorTime: this.armorTime,
      barrelReload: this.barrelCooldown <= 0 ? 1 : clamp(1 - this.barrelCooldown / Math.max(0.001, this.barrelCooldownMax), 0, 1),
      barrelCount: this.powderBarrels.filter((barrel) => barrel.alive).length,
    });
  }

  private finish(reason: EndReason): void {
    if (this.ended) return;
    this.ended = true; this.input.setEnabled(false);
    const result: MatchResult = {
      matchId: crypto.randomUUID(), playerId: this.playerIdentity.id, playerName: this.playerIdentity.displayName.trim() || engineText('playerName'),
      playedAt: new Date().toISOString(), score: this.score,
      duration: Number(Math.min(this.elapsed, this.config.sessionTime).toFixed(2)), endReason: reason,
      config: structuredClone(this.config), seed: this.seed,
    };
    this.callbacks.onEnd(result);
  }

  getDebugState(): {
    elapsed: number;
    score: number;
    pressure: number;
    maxActiveEnemies: number;
    supportInterval: number;
    paused: boolean;
    player: { x: number; y: number; health: number; rotation: number };
    enemies: { id: string; kind: 'chaser' | 'shooter'; x: number; y: number; health: number; stuckTime: number }[];
    projectiles: { owner: 'player' | 'enemy'; x: number; y: number; vx: number; vy: number; damage: number }[];
    pickups: { kind: PickupKind; x: number; y: number; lifetime: number }[];
    barrels: { x: number; y: number; armTime: number; lifetime: number }[];
    cooldowns: { front: number; broadside: number; weaponSwitch: number; dash: number; barrel: number };
    buffs: { powder: number; wind: number; armor: number };
  } {
    return {
      elapsed: this.elapsed,
      score: this.score,
      pressure: this.pressure,
      maxActiveEnemies: this.maxActiveEnemies,
      supportInterval: this.supportInterval,
      paused: this.paused,
      player: { x: this.player.x, y: this.player.y, health: this.player.health, rotation: this.player.rotation },
      enemies: this.enemies.filter((enemy) => enemy.alive).map((enemy) => ({
        id: enemy.id,
        kind: enemy.kind,
        x: enemy.x,
        y: enemy.y,
        health: enemy.health,
        stuckTime: enemy.stuckTime,
      })),
      projectiles: this.projectiles.filter((projectile) => projectile.alive).map((projectile) => ({ owner: projectile.owner, x: projectile.x, y: projectile.y, vx: projectile.vx, vy: projectile.vy, damage: projectile.damage })),
      pickups: this.pickups.filter((pickup) => pickup.alive).map((pickup) => ({ kind: pickup.kind, x: pickup.x, y: pickup.y, lifetime: pickup.lifetime })),
      barrels: this.powderBarrels.filter((barrel) => barrel.alive).map((barrel) => ({ x: barrel.x, y: barrel.y, armTime: barrel.armTime, lifetime: barrel.lifetime })),
      cooldowns: { front: this.frontCooldown, broadside: this.broadsideCooldown, weaponSwitch: this.weaponSwitchCooldown, dash: this.dashCooldown, barrel: this.barrelCooldown },
      buffs: { powder: this.powderTime, wind: this.windTime, armor: this.armorTime },
    };
  }

  debugDamagePlayer(amount: number): void {
    if (!this.player?.alive) return;
    this.damageShip(this.player, Math.max(0, amount));
    this.emitSnapshot(true);
  }

  debugSpawnPickup(kind: PickupKind): void {
    if (!this.player?.alive) return;
    this.spawnPickup(kind, this.player.x, this.player.y);
  }

  debugSpawnEnemy(kind: 'chaser' | 'shooter', x: number, y: number, health?: number): string {
    const tint = kind === 'chaser' ? 0xff575d : 0xca63ff;
    const texture = kind === 'chaser' ? GAME_ASSETS.chaser : GAME_ASSETS.shooter;
    const maxHealth = Math.max(1, health ?? (kind === 'chaser' ? 68 : 82));
    const id = `debug-enemy-${kind}-${this.enemies.length}-${this.elapsed.toFixed(3)}`;
    const enemy = this.makeShip(id, texture, tint, clamp(x, 70, WORLD_W - 70), clamp(y, 70, WORLD_H - 70), maxHealth, 0.52) as EnemyEntity;
    enemy.kind = kind;
    enemy.shootCooldown = 999;
    enemy.preferredOrbitSign = this.rng.next() < 0.5 ? -1 : 1;
    enemy.orbitFlipCooldown = 0;
    enemy.stuckTime = 0;
    enemy.lastAiX = enemy.x;
    enemy.lastAiY = enemy.y;
    enemy.rotation = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    enemy.body.rotation = enemy.rotation - Math.PI / 2;
    this.enemies.push(enemy);
    return id;
  }

  debugSetEnemyShootCooldown(id: string, seconds: number): void {
    const enemy = this.enemies.find((candidate) => candidate.id === id && candidate.alive);
    if (!enemy || !Number.isFinite(seconds)) return;
    enemy.shootCooldown = Math.max(0, seconds);
  }

  debugSetTimeRemaining(seconds: number): void {
    if (!Number.isFinite(seconds) || this.ended) return;
    this.elapsed = clamp(this.config.sessionTime - Math.max(0, seconds), 0, this.config.sessionTime);
    this.emitSnapshot(true);
  }

  debugAdvanceTime(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.ended || this.paused) return;
    const fixedStep = 1 / 30;
    let remaining = Math.min(seconds, 240);
    while (remaining > 0 && !this.ended && !this.paused) {
      const step = Math.min(fixedStep, remaining);
      this.tick({ deltaMS: step * 1000 });
      remaining -= step;
    }
  }

  debugSetPlayerPose(x: number, y: number, rotation = this.player.rotation): void {
    if (!this.player?.alive) return;
    const px = clamp(x, this.player.radius + 30, WORLD_W - this.player.radius - 30);
    const py = clamp(y, this.player.radius + 30, WORLD_H - this.player.radius - 30);
    if (this.collidesIsland(px, py, this.player.radius)) return;
    this.player.x = px;
    this.player.y = py;
    this.player.rotation = rotation;
    this.player.view.position.set(px, py);
    this.player.body.rotation = rotation - Math.PI / 2;
  }

  togglePause(force?: boolean): void {
    if (this.ended) return;
    this.paused = force ?? !this.paused;
    this.input.setEnabled(!this.paused);
    if (this.initialized) this.app.ticker.speed = this.paused ? 0 : 1;
    this.emitSnapshot(true);
  }

  setAction(action: GameAction, down: boolean): void {
    this.input.set(action, down);
    if (!down || !this.started || this.paused || this.ended) return;

    // Touch taps can begin and end between two ticker frames. Trigger discrete
    // actions on pointer-down so a valid tap is never lost; cooldowns still
    // prevent a held button from double-firing on the following simulation tick.
    if (action === 'fire' && this.frontCooldown <= 0) {
      if (this.canFireWeaponNow()) this.fireFront();
      else this.bufferWeaponAction('fire');
    } else if (action === 'broadsideLeft' && this.broadsideCooldown <= 0) {
      if (this.canFireWeaponNow()) this.fireBroadside(-1);
      else this.bufferWeaponAction('broadsideLeft');
    } else if (action === 'broadsideRight' && this.broadsideCooldown <= 0) {
      if (this.canFireWeaponNow()) this.fireBroadside(1);
      else this.bufferWeaponAction('broadsideRight');
    } else if (action === 'dash' && this.dashCooldown <= 0) this.performDash();
    else if (action === 'barrel' && this.barrelCooldown <= 0) this.deployPowderBarrel();
  }
  get isPaused(): boolean { return this.paused; }

  private onVisibility = (): void => { if (document.hidden && !this.ended) { this.visibilityPause = true; this.togglePause(true); } };
  private onBlur = (): void => { if (!this.ended) { this.visibilityPause = true; this.togglePause(true); } };
  consumeVisibilityPause(): boolean { const value = this.visibilityPause; this.visibilityPause = false; return value; }

  private resize = (): void => {
    const w = this.host.clientWidth || WORLD_W; const h = this.host.clientHeight || WORLD_H;
    const scale = Math.min(w / WORLD_W, h / WORLD_H);
    this.app.canvas.style.width = `${WORLD_W * scale}px`;
    this.app.canvas.style.height = `${WORLD_H * scale}px`;
  };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    this.input.detach();
    if (this.initialized) {
      this.app.ticker.remove(this.tick);
      for (const entry of this.activeComicPanels) this.app.ticker.remove(entry.update);
      this.activeComicPanels = [];
      this.app.destroy(true, { children: true, texture: false });
    }
    this.audio.clear();
  }
}
