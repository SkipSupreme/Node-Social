import { useQuery } from '@tanstack/react-query';
import { getNodes, getNode } from '../lib/api';

export function useNodes() {
  return useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
    staleTime: 5 * 60 * 1000, // 5 min — nodes rarely change
  });
}

export function useNode(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: ['node', idOrSlug],
    queryFn: () => getNode(idOrSlug!),
    enabled: !!idOrSlug,
    staleTime: 5 * 60 * 1000,
  });
}
