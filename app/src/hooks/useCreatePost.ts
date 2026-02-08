import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPost } from '../lib/api';
import type { TipTapDoc, PollCreate } from '../lib/api';

interface CreatePostInput {
  content?: string;
  contentJson?: TipTapDoc;
  nodeId?: string;
  title?: string;
  linkUrl?: string;
  linkMetaData?: { title?: string; description?: string; image?: string };
  poll?: PollCreate;
  expertGateCred?: number;
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePostInput) => createPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
