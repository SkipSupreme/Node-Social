import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

// Bot definitions with their target nodes
const BOTS = [
  {
    username: 'TechDigest',
    displayName: 'Tech Digest',
    nodeSlug: 'technology',
    bio: 'Curating the best in tech. AI-powered, human-approved.',
  },
  {
    username: 'ScienceDaily',
    displayName: 'Science Daily',
    nodeSlug: 'science',
    bio: 'Your daily dose of scientific discovery.',
  },
  {
    username: 'CodeCurator',
    displayName: 'Code Curator',
    nodeSlug: 'programming',
    bio: 'Quality code content, zero fluff.',
  },
  {
    username: 'CosmicNews',
    displayName: 'Cosmic News',
    nodeSlug: 'astronomy',
    bio: 'Eyes on the universe.',
  },
  {
    username: 'MathMind',
    displayName: 'Math Mind',
    nodeSlug: 'math',
    bio: 'Beautiful mathematics, elegantly explained.',
  },
  {
    username: 'AIInsider',
    displayName: 'AI Insider',
    nodeSlug: 'ai',
    bio: 'Tracking the AI revolution.',
  },
  {
    username: 'GodotGuru',
    displayName: 'Godot Guru',
    nodeSlug: 'godot',
    bio: 'Game dev with Godot, tutorials and news.',
  },
  {
    username: 'DesignDaily',
    displayName: 'Design Daily',
    nodeSlug: 'graphic-design',
    bio: 'Inspiration for visual creators.',
  },
  {
    username: 'UXCurator',
    displayName: 'UX Curator',
    nodeSlug: 'ui-ux',
    bio: 'Better interfaces, better experiences.',
  },
  {
    username: 'ArtStream',
    displayName: 'Art Stream',
    nodeSlug: 'art',
    bio: 'Digital and traditional art that inspires.',
  },
  {
    username: 'MTGDigest',
    displayName: 'MTG Digest',
    nodeSlug: 'mtg',
    bio: 'Magic: The Gathering news and strategy.',
  },
  {
    username: 'BlenderBot',
    displayName: 'Blender Bot',
    nodeSlug: 'blender',
    bio: '3D art and Blender tutorials.',
  },
  {
    username: 'SoulSeeker',
    displayName: 'Soul Seeker',
    nodeSlug: 'spirituality',
    bio: 'Mindfulness, meditation, and meaning.',
  },
  {
    username: 'TubeWatch',
    displayName: 'Tube Watch',
    nodeSlug: 'youtube',
    bio: 'The best of YouTube, curated.',
  },
];

// Node definitions to create
const NODES = [
  { slug: 'technology', name: 'Technology', description: 'Tech news, gadgets, and innovation', color: '#3B82F6' },
  { slug: 'science', name: 'Science', description: 'Scientific discoveries and research', color: '#10B981' },
  { slug: 'programming', name: 'Programming', description: 'Code, tutorials, and developer news', color: '#8B5CF6' },
  { slug: 'astronomy', name: 'Astronomy', description: 'Space, stars, and the cosmos', color: '#1E3A5F' },
  { slug: 'math', name: 'Mathematics', description: 'Beautiful proofs and mathematical insights', color: '#F59E0B' },
  { slug: 'ai', name: 'Artificial Intelligence', description: 'AI, ML, and the future of intelligence', color: '#EC4899' },
  { slug: 'godot', name: 'Godot', description: 'Godot game engine tutorials and news', color: '#478CBF' },
  { slug: 'graphic-design', name: 'Graphic Design', description: 'Visual design inspiration and techniques', color: '#F97316' },
  { slug: 'ui-ux', name: 'UI/UX Design', description: 'User experience and interface design', color: '#06B6D4' },
  { slug: 'art', name: 'Art', description: 'Digital and traditional art', color: '#EF4444' },
  { slug: 'mtg', name: 'Magic: The Gathering', description: 'MTG news, strategy, and community', color: '#854D0E' },
  { slug: 'blender', name: 'Blender', description: '3D modeling and animation with Blender', color: '#EA7600' },
  { slug: 'spirituality', name: 'Spirituality', description: 'Mindfulness, meditation, and meaning', color: '#7C3AED' },
  { slug: 'youtube', name: 'YouTube', description: 'The best of YouTube, curated', color: '#FF0000' },
];

async function main() {
  console.log('Seeding curator nodes and bots...\n');

  // Get all vectors for node weight initialization
  const allVectors = await prisma.vibeVector.findMany();

  // Create nodes first
  console.log('--- Creating Nodes ---');
  for (const nodeData of NODES) {
    const node = await prisma.node.upsert({
      where: { slug: nodeData.slug },
      update: {
        name: nodeData.name,
        description: nodeData.description,
        color: nodeData.color,
      },
      create: nodeData,
    });
    console.log(`  ✓ Node: ${node.name} (${node.slug})`);

    // Initialize default vibe weights for this node
    for (const vector of allVectors) {
      await prisma.nodeVibeWeight.upsert({
        where: {
          nodeId_vectorId: {
            nodeId: node.id,
            vectorId: vector.id,
          },
        },
        update: {},
        create: {
          nodeId: node.id,
          vectorId: vector.id,
          weight: 1.0,
        },
      });
    }
  }

  // Create bot users
  console.log('\n--- Creating Bot Users ---');

  // Generate a secure random password for bots (they won't use it)
  const botPassword = await argon2.hash('bot-account-no-login-' + Date.now());

  for (const botData of BOTS) {
    // Find the target node
    const node = await prisma.node.findUnique({ where: { slug: botData.nodeSlug } });
    if (!node) {
      console.error(`  ✗ Node not found for bot ${botData.username}: ${botData.nodeSlug}`);
      continue;
    }

    const bot = await prisma.user.upsert({
      where: { username: botData.username },
      update: {
        bio: botData.bio,
        isBot: true,
        botConfig: {
          persona: botData.displayName,
          nodeSlug: botData.nodeSlug,
          nodeId: node.id,
        },
      },
      create: {
        email: `${botData.username.toLowerCase()}@node.bot`,
        password: botPassword,
        username: botData.username,
        firstName: botData.displayName.split(' ')[0],
        lastName: botData.displayName.split(' ').slice(1).join(' ') || undefined,
        bio: botData.bio,
        emailVerified: true, // Bots don't need verification
        isBot: true,
        botConfig: {
          persona: botData.displayName,
          nodeSlug: botData.nodeSlug,
          nodeId: node.id,
        },
      },
    });
    console.log(`  ✓ Bot: @${bot.username} → ${botData.nodeSlug}`);

    // Link node to its curator bot
    await prisma.node.update({
      where: { id: node.id },
      data: { curatorBotId: bot.id },
    });

    // Subscribe bot to its own node
    await prisma.nodeSubscription.upsert({
      where: {
        userId_nodeId: {
          userId: bot.id,
          nodeId: node.id,
        },
      },
      update: {},
      create: {
        userId: bot.id,
        nodeId: node.id,
        role: 'member',
      },
    });
  }

  console.log('\n✓ Seeding complete!');
  console.log(`  - ${NODES.length} nodes created/updated`);
  console.log(`  - ${BOTS.length} bots created/updated`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
