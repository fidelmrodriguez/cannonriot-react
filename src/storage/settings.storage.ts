import { CONFIG_LIMITS, DEFAULT_CONFIG } from '../game/core/config';
import type { GameConfig } from '../types/game';

const KEY = 'cannon-riot:settings';

function snap(value: unknown, min: number, max: number, step: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const clamped = Math.max(min, Math.min(max, value));
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Number(Math.max(min, Math.min(max, snapped)).toFixed(2));
}

function sanitizeSettings(value: unknown): GameConfig {
  const raw = value && typeof value === 'object' ? value as Partial<GameConfig> : {};
  return {
    ...DEFAULT_CONFIG,
    sessionTime: snap(raw.sessionTime, CONFIG_LIMITS.sessionTime.min, CONFIG_LIMITS.sessionTime.max, CONFIG_LIMITS.sessionTime.step, DEFAULT_CONFIG.sessionTime),
    enemySpawnTime: snap(raw.enemySpawnTime, CONFIG_LIMITS.enemySpawnTime.min, CONFIG_LIMITS.enemySpawnTime.max, CONFIG_LIMITS.enemySpawnTime.step, DEFAULT_CONFIG.enemySpawnTime),
  };
}

export function loadSettings(): GameConfig {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveSettings(config: GameConfig): void {
  localStorage.setItem(KEY, JSON.stringify(sanitizeSettings(config)));
}
