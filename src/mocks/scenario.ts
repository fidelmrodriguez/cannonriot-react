import type { NetworkScenario } from '../types/game';

const KEY = 'cannon-riot:network-scenario';
const DB_KEY = 'cannon-riot:mock-db';
const REQUEST_SEQUENCE_KEY = 'cannon-riot:mock-request-sequence';

const VALID = new Set<NetworkScenario>([
  'normal', 'empty', 'pagination', 'slow', 'timeout', 'variable-latency', 'out-of-order',
  'network-error', 'client-error', 'server-error', 'ranking-error', 'history-error',
  'timeout-after-save', 'unavailable-on-game-over',
]);

export function getScenario(): NetworkScenario {
  const value = localStorage.getItem(KEY) as NetworkScenario | null;
  return value && VALID.has(value) ? value : 'normal';
}

export function setScenario(value: NetworkScenario): void {
  localStorage.setItem(KEY, value);
}

export function resetMockState(): void {
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem(REQUEST_SEQUENCE_KEY);
  localStorage.setItem(KEY, 'normal');
}
