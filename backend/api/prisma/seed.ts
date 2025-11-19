import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

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

