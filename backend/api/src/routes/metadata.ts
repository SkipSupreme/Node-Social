import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import { getErrorMessage } from '../lib/errors.js';
import { validateUrlForSSRF } from '../lib/ssrf.js';

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB

const metadataRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.post(
        '/preview',
        {
            onRequest: [fastify.authenticate],
            config: {
                rateLimit: {
                    max: 10,
                    timeWindow: '1 minute',
                },
            },
        },
        async (request, reply) => {
            const schema = z.object({
                url: z.string().url(),
            });

            const parsed = schema.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({ error: 'Invalid URL' });
            }

            const { url } = parsed.data;

            // SSRF protection: validate URL before fetching
            try {
                await validateUrlForSSRF(url);
            } catch (error) {
                return reply.status(400).send({ error: 'URL not allowed' });
            }

            // Check cache first
            const cached = await fastify.prisma.linkMetadata.findUnique({
                where: { url },
            });

            if (cached) {
                return reply.send(cached);
            }

            try {
                // Fetch URL with timeout
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);

                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'NodeSocialBot/1.0 (+https://node-social.com)',
                    },
                    signal: controller.signal,
                });

                clearTimeout(timeout);

                if (!response.ok) {
                    return reply.status(400).send({ error: 'Failed to fetch URL' });
                }

                // Check Content-Length header for size limit
                const contentLength = response.headers.get('content-length');
                const parsedLength = contentLength ? parseInt(contentLength, 10) : 0;
                if (!Number.isNaN(parsedLength) && parsedLength > MAX_RESPONSE_SIZE) {
                    return reply.status(400).send({ error: 'Response too large' });
                }

                const html = await response.text();

                // Check actual body size
                if (html.length > MAX_RESPONSE_SIZE) {
                    return reply.status(400).send({ error: 'Response too large' });
                }

                const $ = cheerio.load(html);

                // Extract metadata
                const title =
                    $('meta[property="og:title"]').attr('content') ||
                    $('title').text() ||
                    '';

                const description =
                    $('meta[property="og:description"]').attr('content') ||
                    $('meta[name="description"]').attr('content') ||
                    '';

                const image =
                    $('meta[property="og:image"]').attr('content') ||
                    '';

                const domain = new URL(url).hostname;

                // Save to DB
                const metadata = await fastify.prisma.linkMetadata.create({
                    data: {
                        url,
                        title: title.substring(0, 500), // Truncate to be safe
                        description: description.substring(0, 1000),
                        image: image.substring(0, 1000),
                        domain,
                    },
                });

                return reply.send(metadata);
            } catch (error: unknown) {
                if (error instanceof Error && error.name === 'AbortError') {
                    return reply.status(408).send({ error: 'Request timed out' });
                }
                fastify.log.error({ error, url }, 'Failed to fetch metadata');
                return reply.status(500).send({ error: 'Failed to fetch metadata' });
            }
        }
    );
};

export default metadataRoutes;
