// src/lib/email.ts
import type { FastifyInstance } from 'fastify';
import type { EmailTemplate } from '../../generated/prisma/client.js';
import { enqueueEmailJob } from './emailQueue.js';

type JobPayload = {
  template: EmailTemplate;
  email: string;
  token: string;
};

async function enqueueEmail(fastify: FastifyInstance, payload: JobPayload) {
  await enqueueEmailJob(fastify, {
    template: payload.template,
    to: payload.email,
    payload: {
      token: payload.token,
    },
  });
}

export async function sendVerificationEmail(
  fastify: FastifyInstance,
  email: string,
  verificationToken: string
) {
  await enqueueEmail(fastify, {
    template: 'VERIFICATION',
    email,
    token: verificationToken,
  });
}

export async function sendPasswordResetEmail(
  fastify: FastifyInstance,
  email: string,
  resetToken: string
) {
  await enqueueEmail(fastify, {
    template: 'PASSWORD_RESET',
    email,
    token: resetToken,
  });
}

