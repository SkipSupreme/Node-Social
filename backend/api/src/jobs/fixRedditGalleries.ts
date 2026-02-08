import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RedditMediaMetadata {
  [key: string]: {
    status: string;
    e: string;
    m: string;
    s: { u: string; x: number; y: number };
  };
}

interface RedditPostData {
  id: string;
  is_gallery?: boolean;
  media_metadata?: RedditMediaMetadata;
  gallery_data?: {
    items: Array<{ media_id: string; caption?: string }>;
  };
}

interface RedditResponse {
  kind: string;
  data: {
    children: Array<{ kind: string; data: RedditPostData }>;
  };
}

async function fetchRedditPost(postId: string): Promise<RedditPostData | null> {
  try {
    const url = `https://www.reddit.com/comments/${postId}.json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`  ✗ Reddit API returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    // Reddit returns an array: [post listing, comments listing]
    if (Array.isArray(data) && data[0]?.data?.children?.[0]?.data) {
      return data[0].data.children[0].data;
    }
    return null;
  } catch (err: any) {
    console.log(`  ✗ Error fetching: ${err.message}`);
    return null;
  }
}

function extractGalleryUrls(post: RedditPostData): string[] {
  const urls: string[] = [];

  if (post.is_gallery && post.media_metadata && post.gallery_data?.items) {
    for (const item of post.gallery_data.items) {
      const meta = post.media_metadata[item.media_id];
      if (meta?.s?.u) {
        // Reddit encodes & as &amp; in the URL
        urls.push(meta.s.u.replace(/&amp;/g, '&'));
      }
    }
  }

  return urls;
}

async function main() {
  console.log('🔄 Fixing Reddit gallery posts...\n');

  // Find all Reddit posts that might be galleries (have reddit sourceUrl and empty galleryUrls)
  const posts = await prisma.post.findMany({
    where: {
      linkUrl: { contains: 'reddit.com' },
      deletedAt: null,
    },
    select: { id: true, title: true, linkUrl: true, galleryUrls: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${posts.length} Reddit posts to check\n`);

  let fixed = 0;
  let skipped = 0;
  let notGallery = 0;
  let failed = 0;

  for (const post of posts) {
    // Skip if already has gallery URLs
    if (post.galleryUrls && post.galleryUrls.length > 0) {
      console.log(`✓ Already has gallery: ${post.title?.slice(0, 50)}`);
      skipped++;
      continue;
    }

    // Extract Reddit post ID from URL
    // URLs look like: https://reddit.com/r/subreddit/comments/POST_ID/title/
    const match = post.linkUrl?.match(/\/comments\/([a-z0-9]+)/i);
    if (!match) {
      console.log(`  ⚠ Can't extract ID from: ${post.linkUrl}`);
      failed++;
      continue;
    }

    const redditPostId = match[1];
    if (!redditPostId) {
      failed++;
      continue;
    }
    console.log(`\n🔍 Checking: ${post.title?.slice(0, 50)}`);
    console.log(`   Reddit ID: ${redditPostId}`);

    // Fetch from Reddit API
    const redditData = await fetchRedditPost(redditPostId);
    if (!redditData) {
      failed++;
      continue;
    }

    // Check if it's a gallery
    if (!redditData.is_gallery) {
      console.log(`   Not a gallery post`);
      notGallery++;
      continue;
    }

    // Extract gallery URLs
    const galleryUrls = extractGalleryUrls(redditData);
    if (galleryUrls.length === 0) {
      console.log(`   Gallery but no images extracted`);
      failed++;
      continue;
    }

    console.log(`   📸 Found ${galleryUrls.length} images!`);

    // Update the post
    await prisma.post.update({
      where: { id: post.id },
      data: { galleryUrls },
    });

    console.log(`   ✅ Updated with ${galleryUrls.length} gallery images`);
    fixed++;

    // Rate limit - be nice to Reddit
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n========== SUMMARY ==========`);
  console.log(`Fixed:      ${fixed}`);
  console.log(`Skipped:    ${skipped} (already had gallery)`);
  console.log(`Not gallery: ${notGallery}`);
  console.log(`Failed:     ${failed}`);
  console.log(`=============================`);
}

main().finally(() => prisma.$disconnect());
