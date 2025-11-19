// src/routes/auth.ts
import type { FastifyPluginAsync } from 'fastify';
import argon2 from 'argon2';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail, sendVerificationEmail } from '../lib/email.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });

  const loginSchema = registerSchema;

  // Helper to generate tokens
  const generateTokens = async (userId: string, email: string) => {
    // Access token: 15 minutes
    const accessToken = fastify.jwt.sign(
      { sub: userId, email },
      { expiresIn: '15m' }
    );

    // Refresh token: 7 days, store in Redis
    const refreshToken = randomBytes(32).toString('hex');
    const refreshKey = `refresh:${userId}:${refreshToken}`;
    await fastify.redis.set(refreshKey, '1', 'EX', 7 * 24 * 60 * 60); // 7 days in seconds

    return { accessToken, refreshToken };
  };

  // Register endpoint with rate limiting
  fastify.post(
    '/register',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input' });
      }

      const { email, password } = parsed.data;

      const existing = await fastify.prisma.user.findUnique({ where: { email } });
      if (existing) {
        return reply.status(400).send({ error: 'Email already in use' });
      }

      const hash = await argon2.hash(password);

      // Generate email verification token
      const verificationToken = randomBytes(32).toString('hex');
      const verificationExpires = new Date();
      verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hour expiry

      const user = await fastify.prisma.user.create({
        data: {
          email,
          password: hash,
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
        },
        select: { id: true, email: true, emailVerified: true, createdAt: true },
      });

      // Send verification email (don't await - send async)
      sendVerificationEmail(email, verificationToken).catch((err) => {
        console.error('Failed to send verification email:', err);
      });

      const { accessToken, refreshToken } = await generateTokens(user.id, user.email);

      return reply.send({
        user,
        token: accessToken,
        refreshToken,
        message: 'Registration successful. Please check your email to verify your account.',
      });
    }
  );

  // Login endpoint with rate limiting
  fastify.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input' });
      }

      const { email, password } = parsed.data;

      const user = await fastify.prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const ok = await argon2.verify(user.password, password);
      if (!ok) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const { accessToken, refreshToken } = await generateTokens(user.id, user.email);

      return reply.send({
        user: { id: user.id, email: user.email, createdAt: user.createdAt },
        token: accessToken,
        refreshToken,
      });
    }
  );

  // Refresh token endpoint
  fastify.post('/refresh', async (request, reply) => {
    const schema = z.object({
      refreshToken: z.string(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { refreshToken } = parsed.data;

    // Find the refresh token in Redis
    const keys = await fastify.redis.keys(`refresh:*:${refreshToken}`);
    if (keys.length === 0) {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }

    // Extract userId from key (format: refresh:userId:token)
    const key = keys[0];
    if (!key) {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
    const userId = key.split(':')[1];
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }

    // Verify user still exists
    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      // Clean up invalid token
      await fastify.redis.del(key);
      return reply.status(401).send({ error: 'User not found' });
    }

    // Rotate refresh token (delete old, create new)
    await fastify.redis.del(key);
    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(
      user.id,
      user.email
    );

    return reply.send({
      token: accessToken,
      refreshToken: newRefreshToken,
    });
  });

  // Logout endpoint
  fastify.post(
    '/logout',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const { refreshToken } = z
        .object({ refreshToken: z.string().optional() })
        .parse(request.body || {});

      // If refresh token provided, revoke it
      if (refreshToken) {
        const key = `refresh:${userId}:${refreshToken}`;
        await fastify.redis.del(key);
      } else {
        // Revoke all refresh tokens for this user
        const keys = await fastify.redis.keys(`refresh:${userId}:*`);
        if (keys.length > 0) {
          await fastify.redis.del(...keys);
        }
      }

      return reply.send({ message: 'Logged out successfully' });
    }
  );

  // Request password reset
  fastify.post(
    '/forgot-password',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request, reply) => {
      const schema = z.object({
        email: z.string().email(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid email' });
      }

      const { email } = parsed.data;

      // Find user (don't reveal if email exists for security)
      const user = await fastify.prisma.user.findUnique({ where: { email } });

      if (user) {
        // Generate reset token
        const resetToken = randomBytes(32).toString('hex');
        const resetTokenExpires = new Date();
        resetTokenExpires.setHours(resetTokenExpires.getHours() + 1); // 1 hour expiry

        // Save token to database
        await fastify.prisma.user.update({
          where: { id: user.id },
          data: { resetToken, resetTokenExpires },
        });

        // Send email
        await sendPasswordResetEmail(email, resetToken);
      }

      // Always return success (don't reveal if email exists)
      return reply.send({ message: 'If that email exists, we sent a password reset link' });
    }
  );

  // Reset password with token
  fastify.post(
    '/reset-password',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
        },
      },
    },
    async (request, reply) => {
      const schema = z.object({
        token: z.string(),
        password: z.string().min(8),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input' });
      }

      const { token, password } = parsed.data;

      // Find user with valid reset token
      const user = await fastify.prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpires: {
            gt: new Date(), // Token not expired
          },
        },
      });

      if (!user) {
        return reply.status(400).send({ error: 'Invalid or expired reset token' });
      }

      // Hash new password
      const hash = await argon2.hash(password);

      // Update password and clear reset token
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hash,
          resetToken: null,
          resetTokenExpires: null,
        },
      });

      // Revoke all refresh tokens for security
      const keys = await fastify.redis.keys(`refresh:${user.id}:*`);
      if (keys.length > 0) {
        await fastify.redis.del(...keys);
      }

      return reply.send({ message: 'Password reset successfully' });
    }
  );

  // Verify email endpoint
  fastify.post('/verify-email', async (request, reply) => {
    const schema = z.object({
      token: z.string(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid token' });
    }

    const { token } = parsed.data;

    // Find user with valid verification token
    const user = await fastify.prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date(), // Token not expired
        },
        emailVerified: false, // Not already verified
      },
    });

    if (!user) {
      return reply.status(400).send({ error: 'Invalid or expired verification token' });
    }

    // Mark email as verified and clear token
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return reply.send({ message: 'Email verified successfully' });
  });

  // Resend verification email endpoint
  fastify.post(
    '/resend-verification',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request, reply) => {
      const schema = z.object({
        email: z.string().email(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid email' });
      }

      const { email } = parsed.data;

      // Find user
      const user = await fastify.prisma.user.findUnique({
        where: { email },
        select: { id: true, emailVerified: true },
      });

      if (!user) {
        // Don't reveal if email exists
        return reply.send({ message: 'If that email exists and is unverified, we sent a verification link' });
      }

      if (user.emailVerified) {
        return reply.status(400).send({ error: 'Email already verified' });
      }

      // Generate new verification token
      const verificationToken = randomBytes(32).toString('hex');
      const verificationExpires = new Date();
      verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hour expiry

      // Update user with new token
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
        },
      });

      // Send verification email
      await sendVerificationEmail(email, verificationToken);

      return reply.send({ message: 'If that email exists and is unverified, we sent a verification link' });
    }
  );
};

export default authRoutes;
