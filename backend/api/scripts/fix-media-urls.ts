/**
 * One-time migration script to convert absolute media URLs to relative paths.
 *
 * This fixes the mixed content warning where avatars/banners stored with
 * http://localhost:3000/uploads/... URLs don't work in production.
 *
 * Run with: npx tsx scripts/fix-media-urls.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Pattern to match absolute URLs that should be converted to relative
// Matches: http://localhost:3000/uploads/..., https://api.node-social.com/uploads/...
const ABSOLUTE_URL_PATTERN = /^https?:\/\/[^/]+(\/.+)$/;

function toRelativePath(url: string | null): string | null {
  if (!url) return url;

  const match = url.match(ABSOLUTE_URL_PATTERN);
  if (match && match[1]?.startsWith('/uploads/')) {
    return match[1]; // Return just the path part
  }

  // Already relative or not a uploads URL
  return url;
}

async function fixUserAvatars() {
  console.log('Fixing User avatars and banners...');

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { avatar: { contains: '://' } },
        { bannerImage: { contains: '://' } },
      ],
    },
    select: { id: true, avatar: true, bannerImage: true },
  });

  console.log(`Found ${users.length} users with absolute URLs`);

  for (const user of users) {
    const newAvatar = toRelativePath(user.avatar);
    const newBanner = toRelativePath(user.bannerImage);

    if (newAvatar !== user.avatar || newBanner !== user.bannerImage) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          avatar: newAvatar,
          bannerImage: newBanner,
        },
      });
      console.log(`  Updated user ${user.id}`);
    }
  }
}

async function fixNodeAvatars() {
  console.log('Fixing Node avatars and banners...');

  const nodes = await prisma.node.findMany({
    where: {
      OR: [
        { avatar: { contains: '://' } },
        { banner: { contains: '://' } },
      ],
    },
    select: { id: true, avatar: true, banner: true },
  });

  console.log(`Found ${nodes.length} nodes with absolute URLs`);

  for (const node of nodes) {
    const newAvatar = toRelativePath(node.avatar);
    const newBanner = toRelativePath(node.banner);

    if (newAvatar !== node.avatar || newBanner !== node.banner) {
      await prisma.node.update({
        where: { id: node.id },
        data: {
          avatar: newAvatar,
          banner: newBanner,
        },
      });
      console.log(`  Updated node ${node.id}`);
    }
  }
}

async function fixPostMedia() {
  console.log('Fixing Post media URLs...');

  const posts = await prisma.post.findMany({
    where: {
      mediaUrl: { contains: '://' },
    },
    select: { id: true, mediaUrl: true },
  });

  console.log(`Found ${posts.length} posts with absolute media URLs`);

  for (const post of posts) {
    const newMediaUrl = toRelativePath(post.mediaUrl);

    if (newMediaUrl !== post.mediaUrl) {
      await prisma.post.update({
        where: { id: post.id },
        data: { mediaUrl: newMediaUrl },
      });
      console.log(`  Updated post ${post.id}`);
    }
  }
}

async function main() {
  console.log('=== Media URL Migration ===\n');
  console.log('Converting absolute URLs to relative paths...\n');

  try {
    await fixUserAvatars();
    console.log('');
    await fixNodeAvatars();
    console.log('');
    await fixPostMedia();
    console.log('\n=== Migration Complete ===');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
