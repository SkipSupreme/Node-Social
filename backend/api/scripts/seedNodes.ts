import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

const nodes = [
    {
        name: 'Chaos',
        slug: 'chaos',
        description: 'Embrace the entropy.',
        color: '#ef4444', // Red
    },
    {
        name: 'Global',
        slug: 'global',
        description: 'The main feed of everything.',
        color: '#3b82f6', // Blue
    },
    {
        name: 'Programming',
        slug: 'programming',
        description: 'Talk about code.',
        color: '#10b981', // Emerald
    },
    {
        name: 'WebDev',
        slug: 'webdev',
        description: 'Building the web.',
        color: '#f59e0b', // Amber
    },
    {
        name: 'Expo',
        slug: 'expo',
        description: 'React Native & Expo goodness.',
        color: '#000000', // Black (or white in dark mode)
    },
    {
        name: 'Ultralight',
        slug: 'ultralight',
        description: 'Minimalist living and travel.',
        color: '#6366f1', // Indigo
    },
    {
        name: 'Funny',
        slug: 'funny',
        description: 'Laugh a little.',
        color: '#ec4899', // Pink
    },
];

async function main() {
    console.log('🌱 Seeding nodes...');

    for (const node of nodes) {
        await prisma.node.upsert({
            where: { slug: node.slug },
            update: {
                name: node.name,
                description: node.description,
                color: node.color,
            },
            create: {
                name: node.name,
                slug: node.slug,
                description: node.description,
                color: node.color,
            },
        });
        console.log(`✅ Upserted n/${node.slug}`);
    }

    console.log('✨ Seeding complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
