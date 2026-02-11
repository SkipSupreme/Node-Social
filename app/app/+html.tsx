import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * Root HTML template for Expo Router web builds.
 * This replaces the default HTML shell and adds performance hints
 * (preconnect, meta tags) that can't be injected at runtime.
 *
 * Only used on web — native builds ignore this file entirely.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ backgroundColor: '#0a0b0d' }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />

        {/* Theme & PWA */}
        <meta name="theme-color" content="#0a0b0d" />
        <meta name="color-scheme" content="dark" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* SEO */}
        <meta
          name="description"
          content="Node Social — a vibe-driven social network connecting Bluesky, Mastodon, and native communities in one multi-dimensional feed."
        />

        {/* Preconnect to API and image CDNs — saves 100-300ms per origin on first request */}
        <link rel="preconnect" href="https://api.node-social.com" />
        <link rel="preconnect" href="https://cdn.bsky.app" crossOrigin="" />
        <link rel="preconnect" href="https://files.mastodon.social" crossOrigin="" />

        {/* Expo Router scroll reset (removes default browser scrollbar styles) */}
        <ScrollViewStyleReset />

        {/* Critical inline styles — prevent FOUC on dark theme */}
        {/* Static literal CSS — no user input, safe to inline */}
        <style
          dangerouslySetInnerHTML={{
            __html: [
              'html, body { height: 100%; min-height: 100dvh; margin: 0; padding: 0; }',
              'body { overflow: hidden; background-color: #0a0b0d; }',
              '#root { display: flex; flex: 1; height: 100%; min-height: 100dvh; }',
            ].join('\n'),
          }}
        />
      </head>
      <body style={{ backgroundColor: '#0a0b0d' }}>
        {children}
      </body>
    </html>
  );
}
