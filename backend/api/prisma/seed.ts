import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

// Phase 0.1 - Initial platform-wide Vibe Vectors
// These are the core reactions available everywhere
const INITIAL_VIBE_VECTORS = [
  { slug: 'funny', name: 'Funny', emoji: '😂', description: 'Made me laugh', order: 1 },
  { slug: 'insightful', name: 'Insightful', emoji: '💡', description: 'Changed my thinking', order: 2 },
  { slug: 'angry', name: 'Angry', emoji: '😠', description: 'Made me upset', order: 3 },
  { slug: 'novel', name: 'Novel', emoji: '🆕', description: 'New or unique', order: 4 },
  { slug: 'cursed', name: 'Cursed', emoji: '👹', description: 'Chaotic energy', order: 5 },
];

async function main() {
  console.log('Seeding database...');

  // Phase 0.1 - Seed initial Vibe Vectors (platform-wide)
  console.log('Seeding Vibe Vectors...');
  for (const vector of INITIAL_VIBE_VECTORS) {
    await prisma.vibeVector.upsert({
      where: { slug: vector.slug },
      update: {
        // Update name/emoji if they changed (but don't change slug)
        name: vector.name,
        emoji: vector.emoji,
        description: vector.description,
        order: vector.order,
      },
      create: vector,
    });
  }
  console.log(`Created/Updated ${INITIAL_VIBE_VECTORS.length} Vibe Vectors`);

  // Create Global Node
  const globalNode = await prisma.node.upsert({
    where: { slug: 'global' },
    update: {},
    create: {
      name: 'Global',
      slug: 'global',
      description: 'The global feed for Node Social.',
    },
  });

  console.log('Created/Found Global Node:', globalNode);

  // Create "Node" Node for testing
  const nodeNode = await prisma.node.upsert({
    where: { slug: 'node' },
    update: {},
    create: {
      name: 'Node',
      slug: 'node',
      description: 'A test community called Node for testing different nodes.',
    },
  });

  console.log('Created/Found Node Node:', nodeNode);

  // Phase 0.1 - Get all vectors to initialize node weights
  const allVectors = await prisma.vibeVector.findMany();

  // Phase 0.1 - Initialize default Node weights for global node (all vectors weight 1.0)
  for (const vector of allVectors) {
    await prisma.nodeVibeWeight.upsert({
      where: {
        nodeId_vectorId: {
          nodeId: globalNode.id,
          vectorId: vector.id,
        },
      },
      update: {},
      create: {
        nodeId: globalNode.id,
        vectorId: vector.id,
        weight: 1.0, // Default equal weight
      },
    });
  }
  console.log('Initialized default Node weights for global node');

  // Phase 0.1 - Initialize default Node weights for "node" node
  for (const vector of allVectors) {
    await prisma.nodeVibeWeight.upsert({
      where: {
        nodeId_vectorId: {
          nodeId: nodeNode.id,
          vectorId: vector.id,
        },
      },
      update: {},
      create: {
        nodeId: nodeNode.id,
        vectorId: vector.id,
        weight: 1.0, // Default equal weight
      },
    });
  }
  console.log('Initialized default Node weights for "node" node');

  // Create a test user if none exists
  const testEmail = 'test@example.com';
  const user = await prisma.user.findUnique({ where: { email: testEmail } });
  
  if (user) {
    console.log('Test user found:', user.id);
    
    // Create a test post
    const post = await prisma.post.create({
      data: {
        content: 'Hello world! This is the first seeded post.',
        authorId: user.id,
        nodeId: globalNode.id,
        title: 'Welcome to Node Social',
      }
    });
    console.log('Created test post:', post.id);
  } else {
    console.log('No test user found (test@example.com). Register one via the API to create posts.');
  }

  console.log('Seeding finished.');
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

