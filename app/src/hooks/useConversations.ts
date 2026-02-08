import { useQuery } from '@tanstack/react-query';
import { getConversations } from '../lib/api';

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    staleTime: 30_000,
    enabled,
  });
}
