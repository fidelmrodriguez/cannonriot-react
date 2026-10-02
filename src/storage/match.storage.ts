import type { MatchResult } from '../types/game';

const LAST_KEY = 'cannon-riot:last-result';
const RESULT_VISIBLE_KEY = 'cannon-riot:last-result-visible';
const OUTBOX_KEY = 'cannon-riot:match-outbox';

function readOutbox(): MatchResult[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed as MatchResult[] : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: MatchResult[]): void {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

export const matchStorage = {
  getLast(): MatchResult | null {
    try { return JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as MatchResult | null; } catch { return null; }
  },
  setLast(result: MatchResult) {
    localStorage.setItem(LAST_KEY, JSON.stringify(result));
    localStorage.setItem(RESULT_VISIBLE_KEY, '1');
  },
  shouldResumeResult(): boolean {
    return localStorage.getItem(RESULT_VISIBLE_KEY) === '1' && this.getLast() !== null;
  },
  dismissResult(): void {
    localStorage.removeItem(RESULT_VISIBLE_KEY);
  },
  getPending(): MatchResult[] {
    return readOutbox();
  },
  enqueue(result: MatchResult): void {
    const items = readOutbox();
    if (!items.some((item) => item.matchId === result.matchId)) {
      items.push(result);
      writeOutbox(items);
    }
  },
  removePending(matchId: string): void {
    writeOutbox(readOutbox().filter((item) => item.matchId !== matchId));
  },
  isPending(matchId: string): boolean {
    return readOutbox().some((item) => item.matchId === matchId);
  },
  clearPending(): void {
    localStorage.removeItem(OUTBOX_KEY);
  },
};
