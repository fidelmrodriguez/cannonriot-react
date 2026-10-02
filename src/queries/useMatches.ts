import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchHistory, fetchRanking, registerMatch } from '../api/matches.api';
import { matchStorage } from '../storage/match.storage';
import { getScenario } from '../mocks/scenario';
import type { MatchResult } from '../types/game';

export function useRanking(page: number, sessionTime: number, enemySpawnTime: number, enabled = true) {
  const networkScenario = getScenario();
  return useQuery({
    queryKey: ['ranking', { sessionTime, enemySpawnTime, page, networkScenario }],
    queryFn: ({ signal }) => fetchRanking(page, sessionTime, enemySpawnTime, signal),
    enabled,
    staleTime: 10_000,
    retry: networkScenario === 'normal' ? 1 : 0,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

export function useHistory(page: number, playerId: string, enabled = true) {
  const networkScenario = getScenario();
  return useQuery({
    queryKey: ['history', { playerId, page, networkScenario }],
    queryFn: ({ signal }) => fetchHistory(page, playerId, signal),
    enabled,
    staleTime: 5_000,
    retry: networkScenario === 'normal' ? 1 : 0,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

export function useRegisterMatch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (match: MatchResult) => {
      matchStorage.enqueue(match);
      const saved = await registerMatch(match);
      matchStorage.removePending(match.matchId);
      return saved;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['ranking'] }),
        client.invalidateQueries({ queryKey: ['history'] }),
      ]);
    },
  });
}
