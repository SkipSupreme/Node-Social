import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFeedPreferences, updateFeedPreferences } from '../lib/api';
import type { FeedPreferenceUpdate } from '../lib/api';

export function useFeedPreferences() {
  return useQuery({
    queryKey: ['feedPreferences'],
    queryFn: getFeedPreferences,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateFeedPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FeedPreferenceUpdate) => updateFeedPreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedPreferences'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] }); // Feed depends on preferences
    },
  });
}
