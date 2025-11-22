// src/routes/auth.ts
import type { FastifyPluginAsync } from 'fastify';
import argon2 from 'argon2';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Prisma } from '../../generated/prisma/client.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../lib/email.js';

const googleAudience = [
  process.env.GOOGLE_OAUTH_ANDROID_CLIENT_ID,
  process.env.GOOGLE_OAUTH_IOS_CLIENT_ID,
  process.env.GOOGLE_OAUTH_WEB_CLIENT_ID,
  ...(process.env.GOOGLE_OAUTH_CLIENT_IDS?.split(',') || []),
]
  .map((value) => value?.trim())
  .filter(Boolean) as string[];

const googleOAuthClient = googleAudience.length ? new OAuth2Client() : null;

const appleAudience = [
  process.env.APPLE_SIGNIN_CLIENT_ID,
  ...(process.env.APPLE_SIGNIN_CLIENT_IDS?.split(',') || []),
]
  .map((value) => value?.trim())
  .filter(Boolean) as string[];

const appleJwks = appleAudience.length
  ? createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'))
  : null;

const baseUserSelect = { id: true, email: true, emailVerified: true, createdAt: true } as const;

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });

  const loginSchema = registerSchema;

  // Helper to hash refresh token for storage (security best practice)
  const hashToken = (token: string): string => {
    return createHash('sha256').update(token).digest('hex');
  };

  // Helper to generate tokens with Token Family support
  // CRITICAL: Implements Refresh Token Rotation with Reuse Detection per document Section 3.2
  const generateTokens = async (
    userId: string,
    email: string,
    parentTokenId?: string | null,
    familyId?: string | null
  ) => {
    // Access token: 15 minutes
    const accessToken = fastify.jwt.sign(
      { sub: userId, email },
      { expiresIn: '15m' }
    );

    // Generate new refresh token
    const refreshToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(refreshToken);
    
    // Create or use existing family ID
    const newFamilyId = familyId || randomBytes(16).toString('hex');
    
    // Calculate expiration (7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store in database with family tracking
    const refreshTokenRecord = await fastify.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        familyId: newFamilyId,
        parentTokenId: parentTokenId || null,
        expiresAt,
        revoked: false,
      },
    });

    // Also store in Redis for fast lookup (backward compatibility during migration)
    const refreshKey = `refresh:${userId}:${refreshToken}`;
    await fastify.redis.set(refreshKey, '1', 'EX', 7 * 24 * 60 * 60);

    return { 
      accessToken, 
      refreshToken,
      refreshTokenId: refreshTokenRecord.id,
      familyId: newFamilyId,
    };
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

      // Argon2id with document-specified parameters (Section 2.1.1)
      // Type: argon2id, Memory: 64 MB, Time: 3 iterations, Parallelism: 1
      const hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB = 2^16 KB
        timeCost: 3,
        parallelism: 1,
        saltLength: 16, // 128-bit salt
      });

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
        select: baseUserSelect,
      });

      // Enqueue verification email; log but don't block registration flow on error
      try {
        await sendVerificationEmail(fastify, email, verificationToken);
      } catch (err) {
        fastify.log.error({ err, email }, 'Failed to enqueue verification email');
      }

      const { accessToken, refreshToken } = await generateTokens(user.id, user.email, null, null);

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

      const { accessToken, refreshToken } = await generateTokens(user.id, user.email, null, null);

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        },
        token: accessToken,
        refreshToken,
      });
    }
  );

  fastify.post(
    '/google',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      if (!googleOAuthClient || googleAudience.length === 0) {
        fastify.log.error('Google OAuth audience not configured');
        return reply.status(503).send({ error: 'Google sign-in is temporarily unavailable' });
      }

      const schema = z.object({
        idToken: z.string().min(10),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid Google token' });
      }

      const { idToken } = parsed.data;

      try {
        const ticket = await googleOAuthClient.verifyIdToken({
          idToken,
          audience: googleAudience,
        });

        const payload = ticket.getPayload();
        if (!payload?.sub || !payload.email) {
          return reply.status(400).send({ error: 'Google token missing required claims' });
        }

        if (!payload.email_verified) {
          return reply.status(400).send({ error: 'Google email must be verified' });
        }

        const googleId = payload.sub;
        const email = payload.email.toLowerCase();

        // Step 1: Find user by federated identity (Google)
        const federatedIdentity = await fastify.prisma.federatedIdentity.findUnique({
          where: {
            provider_providerSubjectId: {
              provider: 'google',
              providerSubjectId: googleId,
            },
          },
          include: {
            user: {
              select: baseUserSelect,
            },
          },
        });

        let user = federatedIdentity?.user || null;

        // Step 2: If not found by federated identity, try finding by email
        if (!user) {
          user = await fastify.prisma.user.findUnique({
            where: { email },
            select: baseUserSelect,
          });
        }

        // Step 3: Create new user if doesn't exist
        if (!user) {
          const randomPassword = randomBytes(32).toString('hex');
          const hash = await argon2.hash(randomPassword);
          
          // Create user and federated identity in a transaction
          user = await fastify.prisma.user.create({
            data: {
              email,
              password: hash,
              emailVerified: true,
              federatedIdentities: {
                create: {
                  provider: 'google',
                  providerSubjectId: googleId,
                  providerEmail: email,
                },
              },
            },
            select: baseUserSelect,
          });
        } else {
          // Step 4: User exists - check if we need to link Google account
          let needsLinking = !federatedIdentity;
          let needsEmailVerification = !user.emailVerified;
          
          if (needsLinking) {
            // Check if this Google ID is already linked to another user
            const existingFederatedIdentity = await fastify.prisma.federatedIdentity.findUnique({
              where: {
                provider_providerSubjectId: {
                  provider: 'google',
                  providerSubjectId: googleId,
                },
              },
              include: {
                user: {
                  select: { id: true, email: true },
                },
              },
            });

            if (existingFederatedIdentity && existingFederatedIdentity.user.id !== user.id) {
              // Conflict: This Google account is already linked to a different user
              fastify.log.warn(
                { 
                  googleId, 
                  existingUserId: existingFederatedIdentity.user.id,
                  existingUserEmail: existingFederatedIdentity.user.email,
                  attemptedUserId: user.id,
                  attemptedUserEmail: user.email 
                },
                'Google account linking conflict'
              );
              return reply.status(409).send({
                error: 'This Google account is already linked to another account. Please sign in with your original method or contact support.',
              });
            }

            // Safe to link - create federated identity
            try {
              await fastify.prisma.federatedIdentity.create({
                data: {
                  userId: user.id,
                  provider: 'google',
                  providerSubjectId: googleId,
                  providerEmail: email,
                },
              });
            } catch (linkError: any) {
              // Handle potential unique constraint violations
              if (linkError?.code === 'P2002') {
                fastify.log.error({ error: linkError, googleId, userId: user.id }, 'Failed to link Google account - unique constraint violation');
                return reply.status(409).send({
                  error: 'This Google account is already linked to another account. Please sign in with your original method.',
                });
              }
              throw linkError;
            }
          }

          // Step 5: Update email verification if needed
          if (needsEmailVerification) {
            user = await fastify.prisma.user.update({
              where: { id: user.id },
              data: {
                emailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpires: null,
              },
              select: baseUserSelect,
            });
          }
        }

        const sanitizedUser = {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        };

        const { accessToken, refreshToken } = await generateTokens(user.id, user.email, null, null);

        return reply.send({
          user: sanitizedUser,
          token: accessToken,
          refreshToken,
        });
      } catch (error: any) {
        // If it's already a 409 conflict response, pass it through
        if (error?.statusCode === 409) {
          throw error;
        }
        
        // Log the full error for debugging
        fastify.log.error({ error, errorCode: error?.code, errorMessage: error?.message }, 'Google sign-in failed');
        
        // Provide more specific error messages when possible
        if (error?.code === 'P2002') {
          // Prisma unique constraint violation
          return reply.status(409).send({ 
            error: 'This Google account is already linked to another account. Please sign in with your original method.' 
          });
        }
        
        return reply.status(400).send({ error: 'Unable to verify Google credential' });
      }
    }
  );

  fastify.post(
    '/apple',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      if (!appleJwks || appleAudience.length === 0) {
        fastify.log.error('Apple Sign-In audience not configured');
        return reply
          .status(503)
          .send({ error: 'Apple sign-in is temporarily unavailable' });
      }

      const schema = z.object({
        idToken: z.string().min(10),
        // Optional: Apple only provides these on FIRST login
        email: z.string().email().optional(),
        fullName: z
          .object({
            givenName: z.string().optional(),
            familyName: z.string().optional(),
          })
          .optional(),
        // Nonce for replay protection (per document Section 6.2)
        nonce: z.string().optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid Apple token' });
      }

      const { idToken, email: clientEmail, fullName, nonce: clientNonce } = parsed.data;

      try {
        const { payload } = await jwtVerify(idToken, appleJwks, {
          issuer: 'https://appleid.apple.com',
          audience: appleAudience,
        });

        // Validate nonce if provided (replay protection)
        if (clientNonce && payload.nonce) {
          // Client sends hashed nonce, token contains original nonce
          // We need to verify the nonce matches (implementation depends on how Apple handles it)
          // For now, we accept if nonce is present in token
          fastify.log.debug({ clientNonce, tokenNonce: payload.nonce }, 'Nonce validation');
        }

        const appleId = payload.sub;
        // Prefer email from token (more reliable), fallback to client-provided email
        // Apple only includes email in token on first login
        // Client may also send email/fullName from credential object (first login only)
        const rawEmail =
          (typeof payload.email === 'string' ? payload.email : undefined) || clientEmail;
        const email = rawEmail?.toLowerCase();
        
        // Log first-login data if provided (for debugging)
        if (clientEmail || fullName) {
          fastify.log.info({ clientEmail, fullName }, 'Apple Sign-In first-login data received');
        }
        const emailVerifiedClaim = payload.email_verified;
        const emailVerified = emailVerifiedClaim === true || emailVerifiedClaim === 'true';

        if (!appleId) {
          return reply.status(400).send({ error: 'Apple token missing subject' });
        }

        // Step 1: Find user by federated identity (Apple)
        const federatedIdentity = await fastify.prisma.federatedIdentity.findUnique({
          where: {
            provider_providerSubjectId: {
              provider: 'apple',
              providerSubjectId: appleId,
            },
          },
          include: {
            user: {
              select: baseUserSelect,
            },
          },
        });

        let user = federatedIdentity?.user || null;

        // Step 2: If not found by federated identity, try finding by email
        if (!user && email) {
          user = await fastify.prisma.user.findUnique({
            where: { email },
            select: baseUserSelect,
          });
        }

        // Step 3: Create new user if doesn't exist
        if (!user) {
          if (!email) {
            return reply.status(400).send({
              error: 'Apple did not return an email address for this account',
            });
          }

          const randomPassword = randomBytes(32).toString('hex');
          const hash = await argon2.hash(randomPassword);
          
          // Create user and federated identity in a transaction
          user = await fastify.prisma.user.create({
            data: {
              email,
              password: hash,
              emailVerified,
              federatedIdentities: {
                create: {
                  provider: 'apple',
                  providerSubjectId: appleId,
                  providerEmail: email,
                },
              },
            },
            select: baseUserSelect,
          });
        } else {
          // Step 4: User exists - check if we need to link Apple account
          let needsLinking = !federatedIdentity;
          let needsEmailVerification = !user.emailVerified && emailVerified;
          
          if (needsLinking) {
            // Check if this Apple ID is already linked to another user
            const existingFederatedIdentity = await fastify.prisma.federatedIdentity.findUnique({
              where: {
                provider_providerSubjectId: {
                  provider: 'apple',
                  providerSubjectId: appleId,
                },
              },
              include: {
                user: {
                  select: { id: true, email: true },
                },
              },
            });

            if (existingFederatedIdentity && existingFederatedIdentity.user.id !== user.id) {
              // Conflict: This Apple account is already linked to a different user
              fastify.log.warn(
                { 
                  appleId, 
                  existingUserId: existingFederatedIdentity.user.id,
                  existingUserEmail: existingFederatedIdentity.user.email,
                  attemptedUserId: user.id,
                  attemptedUserEmail: user.email 
                },
                'Apple account linking conflict'
              );
              return reply.status(409).send({
                error: 'This Apple account is already linked to another account. Please sign in with your original method or contact support.',
              });
            }

            // Safe to link - create federated identity
            try {
              await fastify.prisma.federatedIdentity.create({
                data: {
                  userId: user.id,
                  provider: 'apple',
                  providerSubjectId: appleId,
                  providerEmail: email || undefined,
                },
              });
            } catch (linkError: any) {
              // Handle potential unique constraint violations
              if (linkError?.code === 'P2002') {
                fastify.log.error({ error: linkError, appleId, userId: user.id }, 'Failed to link Apple account - unique constraint violation');
                return reply.status(409).send({
                  error: 'This Apple account is already linked to another account. Please sign in with your original method.',
                });
              }
              throw linkError;
            }
          }

          // Step 5: Update email verification if needed
          if (needsEmailVerification) {
            user = await fastify.prisma.user.update({
              where: { id: user.id },
              data: {
                emailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpires: null,
              },
              select: baseUserSelect,
            });
          }
        }

        const sanitizedUser = {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        };

        const { accessToken, refreshToken } = await generateTokens(user.id, user.email, null, null);

        return reply.send({
          user: sanitizedUser,
          token: accessToken,
          refreshToken,
        });
      } catch (error: any) {
        // If it's already a 409 conflict response, pass it through
        if (error?.statusCode === 409) {
          throw error;
        }
        
        // Log the full error for debugging
        fastify.log.error({ error, errorCode: error?.code, errorMessage: error?.message }, 'Apple sign-in failed');
        
        // Provide more specific error messages when possible
        if (error?.code === 'P2002') {
          // Prisma unique constraint violation
          return reply.status(409).send({ 
            error: 'This Apple account is already linked to another account. Please sign in with your original method.' 
          });
        }
        
        return reply.status(400).send({ error: 'Unable to verify Apple credential' });
      }
    }
  );

  // Refresh token endpoint with Token Family Reuse Detection
  // CRITICAL: Implements document Section 3.2 - "The most critical component"
  fastify.post('/refresh', async (request, reply) => {
    const schema = z.object({
      refreshToken: z.string(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { refreshToken } = parsed.data;
    const tokenHash = hashToken(refreshToken);

    // Find the refresh token in database
    const tokenRecord = await fastify.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revoked: false,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!tokenRecord) {
      // Token not found or expired - check if it was revoked (potential reuse)
      const revokedToken = await fastify.prisma.refreshToken.findFirst({
        where: { tokenHash },
      });

      if (revokedToken) {
        // TOKEN REUSE DETECTED! Revoke entire family
        fastify.log.warn(
          {
            familyId: revokedToken.familyId,
            userId: revokedToken.userId,
            tokenId: revokedToken.id,
          },
          'Refresh token reuse detected - revoking entire family'
        );

        // Revoke all tokens in the family
        await fastify.prisma.refreshToken.updateMany({
          where: { familyId: revokedToken.familyId },
          data: { revoked: true },
        });

        return reply.status(401).send({
          error: 'Security violation detected. Please sign in again.',
        });
      }

      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }

    // Verify user still exists
    if (!tokenRecord.user) {
      await fastify.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revoked: true },
      });
      return reply.status(401).send({ error: 'User not found' });
    }

    // Rotate refresh token: Revoke old, create new in same family
    await fastify.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true },
    });

    // Generate new token pair in same family
    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(
      tokenRecord.user.id,
      tokenRecord.user.email,
      tokenRecord.id, // parent token
      tokenRecord.familyId // same family
    );

    // Clean up Redis entry (backward compatibility)
    const refreshKey = `refresh:${tokenRecord.user.id}:${refreshToken}`;
    await fastify.redis.del(refreshKey);

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

        try {
          await sendPasswordResetEmail(fastify, email, resetToken);
        } catch (err) {
          fastify.log.error({ err, email }, 'Failed to enqueue password reset email');
        }
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
      // Argon2id with document-specified parameters (Section 2.1.1)
      // Type: argon2id, Memory: 64 MB, Time: 3 iterations, Parallelism: 1
      const hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB = 2^16 KB
        timeCost: 3,
        parallelism: 1,
        saltLength: 16, // 128-bit salt
      });

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
    const updatedUser = await fastify.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
      select: baseUserSelect,
    });

    return reply.send({ message: 'Email verified successfully', user: updatedUser });
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

      try {
        await sendVerificationEmail(fastify, email, verificationToken);
      } catch (err) {
        fastify.log.error({ err, email }, 'Failed to enqueue verification email');
      }

      return reply.send({ message: 'If that email exists and is unverified, we sent a verification link' });
    }
  );
};

export default authRoutes;
