/**
 * MediaImage - Image component that auto-resolves relative URLs
 *
 * Use this instead of <Image> for any user-uploaded media (avatars, banners, etc.)
 * It handles both old absolute URLs and new relative paths from the API.
 */

import React, { memo } from 'react';
import { Image, ImageProps, ImageStyle, StyleProp } from 'react-native';
import { resolveMediaUrl } from '../../config';

interface MediaImageProps extends Omit<ImageProps, 'source'> {
  /** The URL from the API (can be relative like /uploads/... or absolute) */
  uri: string | null | undefined;
  /** Fallback URL if uri is empty */
  fallback?: string;
  /** Image style */
  style?: StyleProp<ImageStyle>;
}

/**
 * Image component that automatically resolves relative URLs to absolute URLs.
 * Use for any user-uploaded content (avatars, banners, post media, etc.)
 */
export const MediaImage = memo(({ uri, fallback, style, ...props }: MediaImageProps) => {
  const resolvedUri = resolveMediaUrl(uri) || fallback;

  if (!resolvedUri) {
    return null;
  }

  return (
    <Image
      source={{ uri: resolvedUri }}
      style={style}
      {...props}
    />
  );
});

MediaImage.displayName = 'MediaImage';

export default MediaImage;
