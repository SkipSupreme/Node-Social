
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Connecting to DB...');
        await prisma.$connect();
        console.log('Connected.');

        console.log('Checking User table...');
        const userCount = await prisma.user.count();
        console.log(`User count: ${userCount}`);

        console.log('Creating test user...');
        const testUser = await prisma.user.create({
            data: {
                email: `test_${Date.now()}@example.com`,
                password: 'hashedpassword',
                username: `testuser_${Date.now()}`,
                firstName: 'Test',
                lastName: 'User',
                dateOfBirth: new Date('2000-01-01'),
                era: 'Zoomer Era',
            },
        });
        console.log('Test user created:', testUser.id);

        console.log('Deleting test user...');
        await prisma.user.delete({ where: { id: testUser.id } });
        console.log('Test user deleted.');

        console.log('DB Check Passed.');
    } catch (e) {
        console.error('DB Check Failed:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
