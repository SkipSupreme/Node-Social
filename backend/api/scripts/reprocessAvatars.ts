/**
 * One-time migration: re-process existing avatar files from 400x400 JPEG → 200x200 WebP.
 *
 * Usage: npx tsx scripts/reprocessAvatars.ts
 *
 * - Reads all avatar_*.jpg files from /uploads
 * - Resizes to 200x200 WebP
 * - Writes new .webp file alongside the old .jpg
 * - Updates the database path from .jpg → .webp
 * - Deletes old .jpg after successful conversion
 */
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const TARGET_SIZE = 200;
const WEBP_QUALITY = 70;

async function main() {
  const prisma = new PrismaClient();

  try {
    const files = await fs.readdir(UPLOADS_DIR);
    const avatarFiles = files.filter(f => f.startsWith('avatar_') && f.endsWith('.jpg'));

    console.log(`Found ${avatarFiles.length} avatar files to re-process`);

    let converted = 0;
    let failed = 0;

    for (const oldFilename of avatarFiles) {
      const oldPath = path.join(UPLOADS_DIR, oldFilename);
      const newFilename = oldFilename.replace(/\.jpg$/, '.webp');
      const newPath = path.join(UPLOADS_DIR, newFilename);

      try {
        // Read and re-process
        const buffer = await fs.readFile(oldPath);
        const processed = await sharp(buffer)
          .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'cover', position: 'center' })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();

        // Write new file
        await fs.writeFile(newPath, processed);

        // Update database: user avatars
        const oldDbPath = `/uploads/${oldFilename}`;
        const newDbPath = `/uploads/${newFilename}`;

        const userResult = await prisma.user.updateMany({
          where: { avatar: oldDbPath },
          data: { avatar: newDbPath },
        });

        // Update database: node avatars
        const nodeResult = await prisma.node.updateMany({
          where: { avatar: oldDbPath },
          data: { avatar: newDbPath },
        });

        // Delete old file
        await fs.unlink(oldPath);

        const oldSize = buffer.length;
        const newSize = processed.length;
        const savings = ((1 - newSize / oldSize) * 100).toFixed(0);
        console.log(
          `  ${oldFilename} → ${newFilename} (${oldSize} → ${newSize} bytes, ${savings}% smaller)` +
          ` [users: ${userResult.count}, nodes: ${nodeResult.count}]`
        );
        converted++;
      } catch (err) {
        console.error(`  FAILED: ${oldFilename}:`, err);
        failed++;
      }
    }

    // Also process bot avatars
    const botFiles = files.filter(f => f.startsWith('bot_avatar_') && f.endsWith('.jpg'));
    console.log(`\nFound ${botFiles.length} bot avatar files to re-process`);

    for (const oldFilename of botFiles) {
      const oldPath = path.join(UPLOADS_DIR, oldFilename);
      const newFilename = oldFilename.replace(/\.jpg$/, '.webp');
      const newPath = path.join(UPLOADS_DIR, newFilename);

      try {
        const buffer = await fs.readFile(oldPath);
        const processed = await sharp(buffer)
          .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'cover', position: 'center' })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();

        await fs.writeFile(newPath, processed);

        const oldDbPath = `/uploads/${oldFilename}`;
        const newDbPath = `/uploads/${newFilename}`;
        const result = await prisma.user.updateMany({
          where: { avatar: oldDbPath },
          data: { avatar: newDbPath },
        });

        await fs.unlink(oldPath);

        const savings = ((1 - processed.length / buffer.length) * 100).toFixed(0);
        console.log(`  ${oldFilename} → ${newFilename} (${savings}% smaller) [${result.count} updated]`);
        converted++;
      } catch (err) {
        console.error(`  FAILED: ${oldFilename}:`, err);
        failed++;
      }
    }

    // Also process node avatars
    const nodeFiles = files.filter(f => f.startsWith('node_avatar_') && f.endsWith('.jpg'));
    console.log(`\nFound ${nodeFiles.length} node avatar files to re-process`);

    for (const oldFilename of nodeFiles) {
      const oldPath = path.join(UPLOADS_DIR, oldFilename);
      const newFilename = oldFilename.replace(/\.jpg$/, '.webp');
      const newPath = path.join(UPLOADS_DIR, newFilename);

      try {
        const buffer = await fs.readFile(oldPath);
        const processed = await sharp(buffer)
          .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'cover', position: 'center' })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();

        await fs.writeFile(newPath, processed);

        const oldDbPath = `/uploads/${oldFilename}`;
        const newDbPath = `/uploads/${newFilename}`;
        const result = await prisma.node.updateMany({
          where: { avatar: oldDbPath },
          data: { avatar: newDbPath },
        });

        await fs.unlink(oldPath);

        const savings = ((1 - processed.length / buffer.length) * 100).toFixed(0);
        console.log(`  ${oldFilename} → ${newFilename} (${savings}% smaller) [${result.count} updated]`);
        converted++;
      } catch (err) {
        console.error(`  FAILED: ${oldFilename}:`, err);
        failed++;
      }
    }

    console.log(`\nDone: ${converted} converted, ${failed} failed`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
