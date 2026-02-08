import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPost, getComments, savePost, deletePost } from '../lib/api';
import { mapPost, mapComment } from '../lib/mappers';

export function usePost(postId: string | undefined) {
  return useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const post = await getPost(postId!);
      return mapPost(post);
    },
    enabled: !!postId,
    staleTime: 60_000, // 1 min
  });
}

export function useComments(postId: string | undefined, opts?: { parentId?: string; all?: boolean }) {
  return useQuery({
    queryKey: ['comments', postId, opts],
    queryFn: async () => {
      const comments = await getComments(postId!, { parentId: opts?.parentId, all: opts?.all });
      return comments.map(mapComment);
    },
    enabled: !!postId,
    staleTime: 30_000,
  });
}

export function useToggleSave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => savePost(postId),
    onSuccess: (_data, postId) => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['savedPosts'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onSuccess: (_data, postId) => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
