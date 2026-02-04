// Content Intelligence - Tier 2
// Functions for analyzing post content: text length/density, media type detection

/**
 * Text density categories based on character count
 */
export type TextDensity = 'micro' | 'short' | 'medium' | 'long';

/**
 * Media types for more specific categorization than postType
 */
export type MediaType = 'photo' | 'video' | 'gif' | 'audio' | null;

/**
 * Calculate text length and density category from content
 */
export function analyzeTextContent(content: string | null | undefined): {
  textLength: number;
  textDensity: TextDensity;
} {
  const text = content?.trim() || '';
  const textLength = text.length;

  let textDensity: TextDensity;
  if (textLength < 50) {
    textDensity = 'micro';
  } else if (textLength <= 280) {
    textDensity = 'short'; // Tweet-length
  } else if (textLength <= 1000) {
    textDensity = 'medium';
  } else {
    textDensity = 'long';
  }

  return { textLength, textDensity };
}

/**
 * Detect media type from URL and optional content-type header
 * More specific than postType - distinguishes photos from videos from GIFs
 */
export function detectMediaType(
  url: string | null | undefined,
  contentType?: string
): MediaType {
  if (!url) return null;

  const lowerUrl = url.toLowerCase();

  // Check by file extension first (most reliable)
  // Video extensions
  if (/\.(mp4|webm|mov|m4v|avi|mkv|flv|wmv)(\?|$)/i.test(lowerUrl)) {
    return 'video';
  }

  // GIF extension (before photo check since .gif is technically an image)
  if (/\.gif(\?|$)/i.test(lowerUrl)) {
    return 'gif';
  }

  // Audio extensions
  if (/\.(mp3|wav|m4a|ogg|flac|aac|wma)(\?|$)/i.test(lowerUrl)) {
    return 'audio';
  }

  // Photo extensions
  if (/\.(jpg|jpeg|png|webp|avif|bmp|tiff|heic|heif)(\?|$)/i.test(lowerUrl)) {
    return 'photo';
  }

  // Check by content-type header (for URLs without clear extensions)
  if (contentType) {
    const lowerContentType = contentType.toLowerCase();

    if (lowerContentType.startsWith('video/')) {
      return 'video';
    }
    if (lowerContentType === 'image/gif') {
      return 'gif';
    }
    if (lowerContentType.startsWith('image/')) {
      return 'photo';
    }
    if (lowerContentType.startsWith('audio/')) {
      return 'audio';
    }
  }

  // Check for known video hosting patterns
  if (
    lowerUrl.includes('youtube.com') ||
    lowerUrl.includes('youtu.be') ||
    lowerUrl.includes('vimeo.com') ||
    lowerUrl.includes('twitch.tv') ||
    lowerUrl.includes('streamable.com') ||
    lowerUrl.includes('v.redd.it') ||
    lowerUrl.includes('video.twimg.com')
  ) {
    return 'video';
  }

  // Check for known image hosting patterns
  if (
    lowerUrl.includes('i.redd.it') ||
    lowerUrl.includes('imgur.com') ||
    lowerUrl.includes('i.imgur.com') ||
    lowerUrl.includes('pbs.twimg.com') ||
    lowerUrl.includes('preview.redd.it') ||
    lowerUrl.includes('cdn.bsky.app') ||
    lowerUrl.includes('media.tenor.com')
  ) {
    // Could be photo or gif from these hosts, check for gif indicators
    if (lowerUrl.includes('.gif') || lowerUrl.includes('tenor.com')) {
      return 'gif';
    }
    return 'photo';
  }

  // Giphy is always gif
  if (lowerUrl.includes('giphy.com') || lowerUrl.includes('gph.is')) {
    return 'gif';
  }

  return null;
}

/**
 * Infer media type from postType if we can't detect it from URL
 * Fallback for legacy posts
 */
export function inferMediaTypeFromPostType(
  postType: string | null | undefined
): MediaType {
  switch (postType) {
    case 'image':
      return 'photo'; // Assume photo, could be overridden by URL detection
    case 'video':
      return 'video';
    default:
      return null;
  }
}

/**
 * Full content analysis for a post
 * Call this when creating or updating posts
 */
export function analyzePost(post: {
  content?: string | null;
  mediaUrl?: string | null;
  postType?: string | null;
}): {
  textLength: number;
  textDensity: TextDensity;
  mediaType: MediaType;
} {
  const { textLength, textDensity } = analyzeTextContent(post.content);

  // Try to detect from URL first, fall back to inferring from postType
  let mediaType = detectMediaType(post.mediaUrl);
  if (!mediaType && post.postType) {
    mediaType = inferMediaTypeFromPostType(post.postType);
  }

  return { textLength, textDensity, mediaType };
}
