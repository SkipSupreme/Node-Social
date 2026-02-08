import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import dns from 'dns/promises';
import net from 'net';
import { getErrorMessage } from '../lib/errors.js';

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Check if an IP address is in a private/reserved range
 */
function isPrivateIP(ip: string): boolean {
    if (net.isIPv4(ip)) {
        const parts = ip.split('.').map(Number);
        const [a, b] = parts as [number, number, number, number];
        // 10.0.0.0/8
        if (a === 10) return true;
        // 172.16.0.0/12
        if (a === 172 && b >= 16 && b <= 31) return true;
        // 192.168.0.0/16
        if (a === 192 && b === 168) return true;
        // 127.0.0.0/8 (loopback)
        if (a === 127) return true;
        // 0.0.0.0/8
        if (a === 0) return true;
        // 169.254.0.0/16 (link-local)
        if (a === 169 && b === 254) return true;
    }
    // IPv6 loopback
    if (ip === '::1' || ip === '::') return true;
    return false;
}

/**
 * Validate a URL is safe to fetch (not targeting internal/private networks)
 */
async function validateUrlForSSRF(urlString: string): Promise<void> {
    const parsed = new URL(urlString);

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS protocols are allowed');
    }

    // Resolve DNS and check for private IPs
    const addresses = await dns.resolve4(parsed.hostname);
    for (const addr of addresses) {
        if (isPrivateIP(addr)) {
            throw new Error('URL resolves to a private/reserved IP address');
        }
    }
}

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
