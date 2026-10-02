import { api } from './client';
import type { MatchResult, Paginated, RankingEntry } from '../types/game';

export async function fetchRanking(page: number, sessionTime: number, enemySpawnTime: number, signal?: AbortSignal): Promise<Paginated<RankingEntry>> {
  const { data } = await api.get<Paginated<RankingEntry>>('/ranking', { params: { page, sessionTime, enemySpawnTime }, signal });
  return data;
}

export async function fetchHistory(page: number, playerId: string, signal?: AbortSignal): Promise<Paginated<MatchResult>> {
  const { data } = await api.get<Paginated<MatchResult>>('/history', { params: { page, playerId }, signal });
  return data;
}

export async function registerMatch(match: MatchResult): Promise<MatchResult> {
  const { data } = await api.post<MatchResult>('/matches', match, { headers: { 'Idempotency-Key': match.matchId } });
  return data;
}
