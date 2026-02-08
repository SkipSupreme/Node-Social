import { useQuery } from '@tanstack/react-query';
import { getUserPosts, getUserStats, getUserComments } from '../lib/api';

export function useUserPosts(userId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ['userPosts', userId, limit],
    queryFn: () => getUserPosts(userId!, limit),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useUserStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['userStats', userId],
    queryFn: () => getUserStats(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useUserComments(userId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ['userComments', userId, limit],
    queryFn: () => getUserComments(userId!, limit),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
