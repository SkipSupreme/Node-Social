import dns from 'dns/promises';
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
 * Validate a URL is safe to fetch (not targeting internal/private networks).
 *
 * Known limitation: DNS rebinding (TOCTOU) — we resolve DNS here for validation,
 * but fetch() resolves DNS again independently. An attacker's DNS server could
 * return a public IP for the first resolution and a private IP for the second.
 * Mitigating this fully requires a custom http.Agent with a pinned lookup callback.
 */
export async function validateUrlForSSRF(urlString: string): Promise<void> {
    const parsed = new URL(urlString);

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS protocols are allowed');
    }

    // Resolve both A (IPv4) and AAAA (IPv6) records
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
}
