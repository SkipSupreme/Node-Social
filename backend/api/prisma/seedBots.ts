import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

// Bot definitions with their target nodes
const BOTS = [
  {
    username: 'CodeCurator',
    displayName: 'Code Curator',
    nodeSlug: 'programming',
    bio: 'Quality code content, zero fluff.',
  },
];

// Node definitions to create
const NODES = [
  { slug: 'programming', name: 'Programming', description: 'Code, tutorials, and developer news', color: '#8B5CF6' },
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
        firstName: botData.displayName.split(' ')[0] || null,
        lastName: botData.displayName.split(' ').slice(1).join(' ') || null,
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
