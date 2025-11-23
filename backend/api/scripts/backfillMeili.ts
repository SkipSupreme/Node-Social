
import { PrismaClient } from '../generated/prisma/client.js';
import { MeiliSearch } from 'meilisearch';
import dotenv from 'dotenv';

dotenv.config({ path: 'backend/api/.env' });

const prisma = new PrismaClient();
const meili = new MeiliSearch({
    host: process.env.MEILI_HOST || 'http://localhost:7700',
    apiKey: process.env.MEILI_MASTER_KEY || '',
});

async function main() {
    console.log('Starting MeiliSearch backfill...');

    const index = meili.index('posts');

    // Update settings
    console.log('Updating index settings...');
    await index.updateSettings({
        searchableAttributes: ['content', 'title', 'authorName', 'nodeName'],
        filterableAttributes: ['nodeId', 'authorId', 'createdAt', 'tags'],
        sortableAttributes: ['createdAt', 'engagementScore'],
    });

    // Fetch all posts
    const posts = await prisma.post.findMany({
        where: { deletedAt: null },
        include: {
            author: { select: { id: true, email: true } }, // TODO: Add username
            node: { select: { id: true, name: true } },
            metrics: true,
        },
    });

    console.log(`Found ${posts.length} posts to index.`);

    const documents = posts.map((post: any) => ({
        id: post.id,
        content: post.content,
        title: post.title,
        nodeId: post.nodeId,
        nodeName: post.node?.name,
        authorId: post.authorId,
        authorName: post.author.email.split('@')[0], // Mock username
        createdAt: post.createdAt.getTime(),
        engagementScore: post.metrics?.engagementScore || 0,
    }));

    if (documents.length > 0) {
        const task = await index.addDocuments(documents);
        console.log('Documents added. Task UID:', task.taskUid);
    } else {
        console.log('No documents to add.');
    }

    console.log('Backfill complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
