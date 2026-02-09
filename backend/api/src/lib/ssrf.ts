import dns from 'dns/promises';
import http from 'http';
import https from 'https';
import net from 'net';

/**
 * Check if an IP address is in a private/reserved range.
 * Covers IPv4 private ranges (RFC 1918), loopback, link-local,
 * and IPv6 equivalents including mapped/translated addresses.
 */
export function isPrivateIP(ip: string): boolean {
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

    if (net.isIPv6(ip)) {
        // Loopback and unspecified
        if (ip === '::1' || ip === '::') return true;
        // IPv4-mapped IPv6: ::ffff:x.x.x.x
        const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
        if (v4Mapped && v4Mapped[1]) return isPrivateIP(v4Mapped[1]);
        // fe80::/10 link-local
        if (ip.toLowerCase().startsWith('fe80:')) return true;
        // fc00::/7 unique local (fc00:: and fd00::)
        const first2 = ip.toLowerCase().slice(0, 2);
        if (first2 === 'fc' || first2 === 'fd') return true;
    }

    return false;
}

/**
 * Resolve a hostname and validate that all addresses are public (not private/reserved).
 * Returns the first validated IP and its address family for DNS pinning.
 */
async function validateAndResolve(urlString: string): Promise<{ parsed: URL; pinnedIp: string; family: 4 | 6 }> {
    const parsed = new URL(urlString);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS protocols are allowed');
    }

    const [v4Result, v6Result] = await Promise.allSettled([
        dns.resolve4(parsed.hostname),
        dns.resolve6(parsed.hostname),
    ]);

    const allAddresses: string[] = [];
    if (v4Result.status === 'fulfilled') allAddresses.push(...v4Result.value);
    if (v6Result.status === 'fulfilled') allAddresses.push(...v6Result.value);

    if (allAddresses.length === 0) {
        throw new Error('Could not resolve hostname');
    }

    for (const addr of allAddresses) {
        if (isPrivateIP(addr)) {
            throw new Error('URL resolves to a private/reserved IP address');
        }
    }

    const pinnedIp = allAddresses[0]!;
    return { parsed, pinnedIp, family: net.isIPv4(pinnedIp) ? 4 : 6 };
}

/**
 * Make a single HTTP(S) request with DNS pinned to a pre-validated IP.
 * Does NOT follow redirects — the caller handles redirect re-validation.
 */
function fetchWithPinnedDns(
    urlString: string,
    pinnedIp: string,
    family: 4 | 6,
    options: { headers?: Record<string, string>; signal?: AbortSignal },
): Promise<Response> {
    const parsed = new URL(urlString);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    return new Promise<Response>((resolve, reject) => {
        const reqOptions: http.RequestOptions & { lookup: Function } = {
            method: 'GET',
            headers: options.headers,
            signal: options.signal,
            // Pin DNS to the validated IP, preventing rebinding between validation and connect
            lookup: (
                _hostname: string,
                _opts: unknown,
                cb: (err: Error | null, address: string, family: number) => void,
            ) => {
                cb(null, pinnedIp, family);
            },
        };

        const req = mod.request(urlString, reqOptions, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks);
                const responseHeaders = new Headers();
                for (const [key, value] of Object.entries(res.headers)) {
                    if (value !== undefined) {
                        if (Array.isArray(value)) {
                            value.forEach(v => responseHeaders.append(key, v));
                        } else {
                            responseHeaders.set(key, value);
                        }
                    }
                }
                resolve(new Response(body, {
                    status: res.statusCode ?? 200,
                    statusText: res.statusMessage ?? '',
                    headers: responseHeaders,
                }));
            });
            res.on('error', reject);
        });
        req.on('error', reject);
        req.end();
    });
}

const MAX_REDIRECTS = 5;

/**
 * Fetch a URL with full SSRF protection including DNS pinning.
 *
 * Unlike validateUrlForSSRF() + fetch(), this function eliminates the
 * DNS rebinding (TOCTOU) vulnerability by pinning the validated IP address
 * directly into the HTTP(S) request's DNS lookup callback.
 *
 * Redirects are followed (up to 5 hops) with re-validation at each step.
 */
export async function ssrfSafeFetch(
    urlString: string,
    options: { headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<Response> {
    let currentUrl = urlString;

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
        const { pinnedIp, family } = await validateAndResolve(currentUrl);
        const response = await fetchWithPinnedDns(currentUrl, pinnedIp, family, options);

        // Follow redirects with re-validation on each hop
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location) return response;
            currentUrl = new URL(location, currentUrl).toString();
            continue;
        }

        return response;
    }

    throw new Error('Too many redirects');
}

/**
 * Validate a URL is safe to fetch (not targeting internal/private networks).
 *
 * @deprecated Use ssrfSafeFetch() instead, which combines validation + fetch
 * with DNS pinning to prevent rebinding attacks (TOCTOU).
 */
export async function validateUrlForSSRF(urlString: string): Promise<void> {
    await validateAndResolve(urlString);
}
