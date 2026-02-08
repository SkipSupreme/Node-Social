import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createComment } from '../lib/api';

interface CreateCommentInput {
  postId: string;
  content: string;
  parentId?: string;
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, content, parentId }: CreateCommentInput) =>
      createComment(postId, { content, parentId }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['post', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
