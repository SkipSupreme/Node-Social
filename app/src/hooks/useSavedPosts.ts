import { useQuery } from '@tanstack/react-query';
import { getSavedPosts } from '../lib/api';
import { mapPost } from '../lib/mappers';

export function useSavedPosts(enabled = true) {
  return useQuery({
    queryKey: ['savedPosts'],
    queryFn: async () => {
      const result = await getSavedPosts();
      return (result.posts || []).map(mapPost);
    },
    staleTime: 60_000,
    enabled,
  });
}
