import type { FastifyInstance } from 'fastify';
import { Resend } from 'resend';
import type { EmailTemplate, Prisma } from '../../generated/prisma/client.js';
import { renderEmailFromTemplate } from './emailTemplates.js';

const resendApiKey = process.env.RESEND_API_KEY || '';
const resend = new Resend(resendApiKey);
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

const PROCESS_INTERVAL_MS = 5_000;
const MAX_JOBS_PER_TICK = 10;
const RETRY_SCHEDULE_SECONDS = [30, 60, 300, 900, 1800];

let queueTimer: NodeJS.Timeout | null = null;
let warnedAboutMissingKey = false;

type EnqueueParams = {
  template: EmailTemplate;
  to: string;
  payload: Prisma.InputJsonValue;
  maxAttempts?: number;
};

async function processPendingJobs(fastify: FastifyInstance) {
  if (!resendApiKey) {
    if (!warnedAboutMissingKey) {
      fastify.log.warn('RESEND_API_KEY is not configured; email queue is paused.');
      warnedAboutMissingKey = true;
    }
    return;
  }

  const jobs = await fastify.prisma.emailJob.findMany({
    where: {
      status: 'PENDING',
      nextAttemptAt: {
        lte: new Date(),
      },
    },
    orderBy: {
      nextAttemptAt: 'asc',
    },
    take: MAX_JOBS_PER_TICK,
  });

  for (const job of jobs) {
    const { id: jobId, to, template, payload, attempts, maxAttempts, nextAttemptAt } = job;
    const currentNextAttemptAt: Date = (nextAttemptAt ?? new Date()) as Date;

    const attemptNumber = attempts + 1;
    try {
      await fastify.prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: 'SENDING',
          attempts: attemptNumber,
          lastError: null,
        },
      });

      const { subject, html } = renderEmailFromTemplate(template, payload);

      await resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to,
        subject,
        html,
      });

      await fastify.prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: 'SENT',
          lastError: null,
        },
      });

      fastify.log.info(
        { jobId, to, template },
        'Email delivered via Resend'
      );
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown Resend error';
      const hasAttemptsLeft = attemptNumber < maxAttempts;
      let nextAttemptAt: Date;
      if (hasAttemptsLeft) {
        const retryIndex = Math.min(
          attemptNumber - 1,
          Math.max(RETRY_SCHEDULE_SECONDS.length - 1, 0)
        );
        const delaySeconds =
          RETRY_SCHEDULE_SECONDS[retryIndex] ??
          RETRY_SCHEDULE_SECONDS[RETRY_SCHEDULE_SECONDS.length - 1] ??
          30;
        nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);
      } else {
        nextAttemptAt = currentNextAttemptAt;
      }

      await fastify.prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: hasAttemptsLeft ? 'PENDING' : 'FAILED',
          lastError: errorMessage,
          nextAttemptAt,
        },
      });

      fastify.log.error(
        {
            jobId,
            to,
            template,
          attemptNumber,
            maxAttempts,
          error: errorMessage,
        },
        'Resend email delivery failed'
      );
    }
  }
}

export function registerEmailQueue(fastify: FastifyInstance) {
  if (queueTimer) return;

  queueTimer = setInterval(() => {
    processPendingJobs(fastify).catch((err) => {
      fastify.log.error({ err }, 'Email queue tick failed');
    });
  }, PROCESS_INTERVAL_MS);

  fastify.addHook('onClose', async () => {
    if (queueTimer) {
      clearInterval(queueTimer);
      queueTimer = null;
    }
  });
}

export async function enqueueEmailJob(
  fastify: FastifyInstance,
  params: EnqueueParams
) {
  await fastify.prisma.emailJob.create({
    data: {
      to: params.to,
      template: params.template,
      payload: params.payload,
      maxAttempts: params.maxAttempts ?? 5,
    },
  });

  fastify.log.info(
    { to: params.to, template: params.template },
    'Email job enqueued'
  );

  setImmediate(() => {
    processPendingJobs(fastify).catch((err) => {
      fastify.log.error({ err }, 'Immediate email processing failed');
    });
  });
}

