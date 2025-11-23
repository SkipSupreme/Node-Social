import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as cheerio from 'cheerio';

const metadataRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.post(
        '/preview',
        {
            onRequest: [fastify.authenticate],
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

            // Check cache first
            const cached = await fastify.prisma.linkMetadata.findUnique({
                where: { url },
            });

            if (cached) {
                return reply.send(cached);
            }

            try {
                // Fetch URL
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'NodeSocialBot/1.0 (+https://node-social.com)',
                    },
                });

                if (!response.ok) {
                    return reply.status(400).send({ error: 'Failed to fetch URL' });
                }

                const html = await response.text();
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
            } catch (error) {
                fastify.log.error({ error, url }, 'Failed to fetch metadata');
                return reply.status(500).send({ error: 'Failed to fetch metadata' });
            }
        }
    );
};

export default metadataRoutes;
