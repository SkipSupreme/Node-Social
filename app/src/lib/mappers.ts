// Maps a raw API comment to the UI comment shape
export function mapComment(c: any) {
  return {
    id: c.id,
    author: {
      id: c.author.id,
      username: c.author.username || 'User',
      avatar: c.author.avatar,
      era: c.author.era || 'Lurker Era',
      cred: c.author.cred || 0,
    },
    content: c.content,
    timestamp: new Date(c.createdAt),
    depth: 0,
    replies: [],
  };
}

// Maps a raw API post to the UI post shape
export function mapPost(p: any) {
  return {
    id: p.id,
    node: {
      id: p.node?.id,
      name: p.node?.name || 'Global',
      slug: p.node?.slug || 'global',
      color: '#6366f1',
    },
    author: {
      id: p.author.id,
      username: p.author.username || 'User',
      avatar: p.author.avatar,
      era: p.author.era || 'Lurker Era',
      cred: p.author.cred || 0,
    },
    title: p.title || 'Untitled Post',
    content: p.content,
    contentJson: p.contentJson,
    contentFormat: p.contentFormat,
    commentCount: p.commentCount,
    createdAt: p.createdAt,
    expertGated: false,
    vibes: [],
    linkUrl: p.linkUrl,
    mediaUrl: p.mediaUrl,
    linkMeta: p.linkMeta,
    poll: p.poll,
    myReaction: p.myReaction,
    vibeAggregate: p.vibeAggregate,
    isSaved: p.isSaved ?? false,
    comments: p.comments?.map(mapComment) || [],
  };
}
