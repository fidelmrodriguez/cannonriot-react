import { delay, http, HttpResponse } from 'msw';
import type { MatchResult, NetworkScenario, Paginated, RankingEntry } from '../types/game';
import { FIXTURE_MATCHES } from './fixtures';
import { DEFAULT_CONFIG } from '../game/core/config';

const DB_KEY = 'cannon-riot:mock-db';
const SCENARIO_KEY = 'cannon-riot:network-scenario';
const PAGE_SIZE = 6;
const REQUEST_SEQUENCE_KEY = 'cannon-riot:mock-request-sequence';

function readDb(): MatchResult[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DB_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed as MatchResult[] : [];
  } catch {
    return [];
  }
}

function writeDb(items: MatchResult[]): void {
  localStorage.setItem(DB_KEY, JSON.stringify(items));
}

function scenario(): NetworkScenario {
  return (localStorage.getItem(SCENARIO_KEY) as NetworkScenario | null) ?? 'normal';
}

async function applyLatency(): Promise<void> {
  const s = scenario();
  const requestSequence = Number(localStorage.getItem(REQUEST_SEQUENCE_KEY) ?? '0') + 1;
  localStorage.setItem(REQUEST_SEQUENCE_KEY, String(requestSequence));
  if (s === 'slow') return delay(1400);
  if (s === 'variable-latency') return delay([120, 760, 260, 1080][(requestSequence - 1) % 4]!);
  if (s === 'out-of-order') return delay(requestSequence % 2 === 1 ? 1150 : 90);
  return delay(140);
}

function commonFailure(): Response | null {
  const s = scenario();
  if (s === 'network-error') return HttpResponse.error();
  if (s === 'client-error') return HttpResponse.json({ message: 'Invalid request for the selected demo scenario.' }, { status: 422 });
  if (s === 'server-error') return HttpResponse.json({ message: 'Simulated service unavailable.' }, { status: 503 });
  return null;
}

async function genericTimeout(): Promise<Response | null> {
  if (scenario() !== 'timeout') return null;
  // Exceed Axios' 3500 ms timeout without mutating server state. This is
  // intentionally distinct from the timeout-after-save scenario.
  await delay(4200);
  return HttpResponse.json({ message: 'Simulated request timeout.' }, { status: 504 });
}

function paginate<T>(items: T[], page: number): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.max(1, Math.min(page, totalPages));
  return {
    items: items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    page: safePage,
    pageSize: PAGE_SIZE,
    total,
    totalPages,
  };
}

export const handlers = [
  http.get('/api/ranking', async ({ request }) => {
    await applyLatency();
    const timeout = await genericTimeout();
    if (timeout) return timeout;
    const failure = commonFailure();
    if (failure) return failure;
    if (scenario() === 'ranking-error') return HttpResponse.json({ message: 'Ranking service unavailable.' }, { status: 503 });
    if (scenario() === 'empty') return HttpResponse.json(paginate([], 1));

    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const sessionTime = Number(url.searchParams.get('sessionTime') ?? 120);
    const enemySpawnTime = Number(url.searchParams.get('enemySpawnTime') ?? 3);
    const all = [...FIXTURE_MATCHES, ...readDb()].filter((match) =>
      match.config.sessionTime === sessionTime && match.config.enemySpawnTime === enemySpawnTime,
    );
    const ranked: RankingEntry[] = all
      .sort((a, b) => b.score - a.score || a.duration - b.duration || a.playedAt.localeCompare(b.playedAt) || a.matchId.localeCompare(b.matchId))
      .map((match, index) => ({ ...match, rank: index + 1 }));
    return HttpResponse.json(paginate(ranked, page));
  }),

  http.get('/api/history', async ({ request }) => {
    await applyLatency();
    const timeout = await genericTimeout();
    if (timeout) return timeout;
    const failure = commonFailure();
    if (failure) return failure;
    if (scenario() === 'history-error') return HttpResponse.json({ message: 'History service unavailable.' }, { status: 503 });
    if (scenario() === 'empty') return HttpResponse.json(paginate([], 1));

    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const playerId = url.searchParams.get('playerId') ?? '';
    let mine = readDb()
      .filter((match) => match.playerId === playerId)
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt) || b.matchId.localeCompare(a.matchId));
    if (scenario() === 'pagination' && mine.length < 13) {
      const base = mine[0] ?? {
        matchId: 'pagination-history-base',
        playerId,
        playerName: 'Captain',
        playedAt: new Date().toISOString(),
        score: 4,
        duration: 75,
        endReason: 'timeout' as const,
        config: { ...DEFAULT_CONFIG, sessionTime: 120, enemySpawnTime: 3 },
        seed: 77,
      };
      const extra = Array.from({ length: 13 - mine.length }, (_, index): MatchResult => ({
        ...base,
        matchId: `pagination-history-${playerId}-${index}`,
        playedAt: new Date(Date.now() - (index + 1) * 60_000).toISOString(),
        score: Math.max(0, base.score - (index % 4)),
      }));
      mine = [...mine, ...extra].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
    }
    return HttpResponse.json(paginate(mine, page));
  }),

  http.post('/api/matches', async ({ request }) => {
    await applyLatency();
    const timeout = await genericTimeout();
    if (timeout) return timeout;
    const s = scenario();
    const failure = commonFailure();
    if (failure) return failure;
    if (s === 'unavailable-on-game-over') return HttpResponse.json({ message: 'Backend unavailable at game over.' }, { status: 503 });

    const match = await request.json() as MatchResult;
    const items = readDb();
    const existing = items.find((item) => item.matchId === match.matchId);
    if (existing) return HttpResponse.json(existing);

    items.push(match);
    writeDb(items);

    if (s === 'timeout-after-save') await delay(5000);
    return HttpResponse.json(match, { status: 201 });
  }),
];
