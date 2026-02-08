import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const AVATAR_SIZE = 400;
const BANNER_WIDTH = 1200;
const BANNER_HEIGHT = 400;
const JPEG_QUALITY = 70;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Magic bytes for image type verification
const IMAGE_MAGIC_BYTES: Record<string, number[]> = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/gif': [0x47, 0x49, 0x46],
};

function verifyMagicBytes(buffer: Buffer, mimetype: string): boolean {
    // WebP: RIFF at offset 0 + WEBP at offset 8
    if (mimetype === 'image/webp') {
        if (buffer.length < 12) return false;
        return buffer[0] === 0x52 && buffer[1] === 0x49 &&
               buffer[2] === 0x46 && buffer[3] === 0x46 &&
               buffer[8] === 0x57 && buffer[9] === 0x45 &&
               buffer[10] === 0x42 && buffer[11] === 0x50;
    }
    const expected = IMAGE_MAGIC_BYTES[mimetype];
    if (!expected) return false;
    if (buffer.length < expected.length) return false;
    return expected.every((byte, i) => buffer[i] === byte);
}

/** Safely delete a previous upload, guarding against path traversal. */
async function safeDeleteUpload(url: string | null | undefined): Promise<void> {
    if (!url || !url.includes('/uploads/')) return;
    const oldFilename = url.split('/uploads/')[1];
    if (!oldFilename) return;
    const resolved = path.resolve(UPLOADS_DIR, oldFilename);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep)) return;
    try { await fs.unlink(resolved); } catch { /* file may not exist */ }
}

async function ensureUploadsDir(): Promise<void> {
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

            if (!ALLOWED_IMAGE_TYPES.includes(data.mimetype)) {
                return reply.status(400).send({
                    error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP'
                });
            }

            // Read file buffer
            const buffer = await data.toBuffer();

            // Verify magic bytes match claimed MIME type
            if (!verifyMagicBytes(buffer, data.mimetype)) {
                return reply.status(400).send({
                    error: 'File content does not match its declared type'
                });
            }

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
            await safeDeleteUpload(user?.avatar);

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
        } catch (error: unknown) {
            fastify.log.error({ err: error }, 'Avatar upload error');
            if (error instanceof Error && 'code' in error && (error as Error & { code: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
                return reply.status(400).send({ error: 'File too large. Maximum size is 5MB' });
            }
            return reply.status(500).send({ error: 'Failed to upload image' });
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

            if (!ALLOWED_IMAGE_TYPES.includes(data.mimetype)) {
                return reply.status(400).send({
                    error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP'
                });
            }

            const buffer = await data.toBuffer();

            // Verify magic bytes match claimed MIME type
            if (!verifyMagicBytes(buffer, data.mimetype)) {
                return reply.status(400).send({
                    error: 'File content does not match its declared type'
                });
            }

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
            await safeDeleteUpload(user?.bannerImage);

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
        } catch (error: unknown) {
            fastify.log.error({ err: error }, 'Banner upload error');
            if (error instanceof Error && 'code' in error && (error as Error & { code: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
                return reply.status(400).send({ error: 'File too large. Maximum size is 5MB' });
            }
            return reply.status(500).send({ error: 'Failed to upload banner' });
        }
    });
};

export default uploadsRoutes;
