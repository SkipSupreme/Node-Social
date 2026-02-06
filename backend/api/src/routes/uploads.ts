import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const AVATAR_SIZE = 400; // Max dimension for avatars
const BANNER_WIDTH = 1200; // Banner width
const BANNER_HEIGHT = 400; // Banner height
const JPEG_QUALITY = 70;

// Ensure uploads directory exists
async function ensureUploadsDir() {
    try {
        await fs.access(UPLOADS_DIR);
    } catch {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
    }
}

const uploadsRoutes: FastifyPluginAsync = async (fastify) => {
    // Ensure uploads dir exists on startup
    await ensureUploadsDir();

    // Upload avatar image
    fastify.post('/avatar', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        const userId = (request.user as { sub: string }).sub;

        try {
            const data = await request.file({
                limits: {
                    fileSize: MAX_FILE_SIZE,
                },
            });

            if (!data) {
                return reply.status(400).send({ error: 'No file uploaded' });
            }

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(data.mimetype)) {
                return reply.status(400).send({
                    error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP'
                });
            }

            // Read file buffer
            const buffer = await data.toBuffer();

            // Process image with sharp: resize and convert to JPEG at 70% quality
            // Flatten with white background to handle transparent PNGs
            const processedImage = await sharp(buffer)
                .flatten({ background: { r: 255, g: 255, b: 255 } }) // White background for transparency
                .resize(AVATAR_SIZE, AVATAR_SIZE, {
                    fit: 'cover',
                    position: 'center',
                })
                .jpeg({ quality: JPEG_QUALITY })
                .toBuffer();

            // Generate unique filename
            const filename = `avatar_${userId}_${randomUUID()}.jpg`;
            const filepath = path.join(UPLOADS_DIR, filename);

            // Delete old avatar if exists
            const user = await fastify.prisma.user.findUnique({
                where: { id: userId },
                select: { avatar: true },
            });

            if (user?.avatar && user.avatar.includes('/uploads/')) {
                const parts = user.avatar.split('/uploads/');
                const oldFilename = parts[1];
                if (oldFilename) {
                    const oldPath = path.join(UPLOADS_DIR, oldFilename);
                    try {
                        await fs.unlink(oldPath);
                    } catch {
                        // Ignore errors if file doesn't exist
                    }
                }
            }

            // Save new file
            await fs.writeFile(filepath, processedImage);

            // Store relative path - frontend resolves full URL from API base
            const avatarUrl = `/uploads/${filename}`;

            // Update user avatar in database
            const updatedUser = await fastify.prisma.user.update({
                where: { id: userId },
                data: { avatar: avatarUrl },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    dateOfBirth: true,
                    bio: true,
                    avatar: true,
                    bannerColor: true,
                    bannerImage: true,
                    cred: true,
                    era: true,
                    theme: true,
                    emailVerified: true,
                    createdAt: true,
                    customCss: true,
                },
            });

            return {
                success: true,
                user: updatedUser,
                url: avatarUrl
            };
        } catch (error: any) {
            console.error('Upload error:', error);

            if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
                return reply.status(400).send({
                    error: 'File too large. Maximum size is 5MB'
                });
            }

            return reply.status(500).send({
                error: 'Failed to upload image'
            });
        }
    });

    // Upload banner image
    fastify.post('/banner', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        const userId = (request.user as { sub: string }).sub;

        try {
            const data = await request.file({
                limits: {
                    fileSize: MAX_FILE_SIZE,
                },
            });

            if (!data) {
                return reply.status(400).send({ error: 'No file uploaded' });
            }

            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(data.mimetype)) {
                return reply.status(400).send({
                    error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP'
                });
            }

            const buffer = await data.toBuffer();

            // Process banner: resize to cover and convert to JPEG
            const processedImage = await sharp(buffer)
                .flatten({ background: { r: 30, g: 30, b: 46 } }) // Dark background for transparency
                .resize(BANNER_WIDTH, BANNER_HEIGHT, {
                    fit: 'cover',
                    position: 'center',
                })
                .jpeg({ quality: JPEG_QUALITY })
                .toBuffer();

            const filename = `banner_${userId}_${randomUUID()}.jpg`;
            const filepath = path.join(UPLOADS_DIR, filename);

            // Delete old banner if exists
            const user = await fastify.prisma.user.findUnique({
                where: { id: userId },
                select: { bannerImage: true },
            });

            if (user?.bannerImage && user.bannerImage.includes('/uploads/')) {
                const parts = user.bannerImage.split('/uploads/');
                const oldFilename = parts[1];
                if (oldFilename) {
                    const oldPath = path.join(UPLOADS_DIR, oldFilename);
                    try {
                        await fs.unlink(oldPath);
                    } catch {
                        // Ignore errors if file doesn't exist
                    }
                }
            }

            await fs.writeFile(filepath, processedImage);

            // Store relative path - frontend resolves full URL from API base
            const bannerUrl = `/uploads/${filename}`;

            const updatedUser = await fastify.prisma.user.update({
                where: { id: userId },
                data: { bannerImage: bannerUrl },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    dateOfBirth: true,
                    bio: true,
                    avatar: true,
                    cred: true,
                    era: true,
                    theme: true,
                    emailVerified: true,
                    createdAt: true,
                    customCss: true,
                    bannerColor: true,
                    bannerImage: true,
                },
            });

            return {
                success: true,
                user: updatedUser,
                url: bannerUrl
            };
        } catch (error: any) {
            console.error('Banner upload error:', error);

            if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
                return reply.status(400).send({
                    error: 'File too large. Maximum size is 5MB'
                });
            }

            return reply.status(500).send({
                error: 'Failed to upload banner'
            });
        }
    });
};

export default uploadsRoutes;
