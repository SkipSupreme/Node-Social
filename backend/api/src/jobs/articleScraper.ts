import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

// Domains that are known to block scraping or require special handling
const BLOCKED_DOMAINS = [
  'twitter.com', 'x.com', // Social media - need API
  'facebook.com', 'instagram.com', // Social media
  'linkedin.com', // Requires login
  'youtube.com', 'youtu.be', // Video platform
  'reddit.com', // Already have content from API
  'github.com', // Code - not articles
  'gitlab.com', // Code
  'v.redd.it', // Reddit video
  'i.redd.it', // Reddit image
  'imgur.com', // Image hosting
];

// Domains that work well with Readability
const ARTICLE_DOMAINS = [
  'techcrunch.com',
  'arstechnica.com',
  'theverge.com',
  'wired.com',
  'engadget.com',
  'medium.com',
  'dev.to',
  'bbc.com',
  'reuters.com',
  'nytimes.com',
  'nature.com',
  'sciencedaily.com',
  'arxiv.org',
];

interface ScrapedArticle {
  title: string | null;
  content: string | null;
  excerpt: string | null;
  byline: string | null;
  siteName: string | null;
  length: number | null;
  leadImage: string | null;
}

/**
 * Check if a URL is likely to be scrapeable for article content
 */
export function isScrapeable(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');

    // Block known non-article domains
    if (BLOCKED_DOMAINS.some(d => hostname.includes(d))) {
      return false;
    }

    // Block direct media URLs
    if (/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mp3|pdf)(\?.*)?$/i.test(url)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Scrape article content from a URL using Readability
 */
export async function scrapeArticle(url: string): Promise<ScrapedArticle | null> {
  if (!isScrapeable(url)) {
    return null;
  }

  try {
    // Fetch the page with a reasonable timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NodeSocial/1.0; Article Curator)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`  → Scrape failed: ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();

    // Create a JSDOM instance
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // Try to extract lead image from meta tags first
    let leadImage: string | null = null;
    const ogImage = document.querySelector('meta[property="og:image"]');
    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    if (ogImage?.getAttribute('content')) {
      leadImage = ogImage.getAttribute('content');
    } else if (twitterImage?.getAttribute('content')) {
      leadImage = twitterImage.getAttribute('content');
    }

    // Use Readability to extract article content
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article || !article.content) {
      console.log(`  → No article content found for ${url}`);
      return null;
    }

    // Extract inline images from the article HTML before stripping
    const inlineImages: string[] = [];
    const imgMatches = article.content.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
    for (const match of imgMatches) {
      const src = match[1];
      // Skip tiny images (likely icons/buttons) and data URLs
      if (src && !src.startsWith('data:') && !src.includes('emoji') && !src.includes('icon')) {
        inlineImages.push(src);
      }
    }

    // Use first inline image as lead if we don't have one from meta tags
    if (!leadImage && inlineImages.length > 0 && inlineImages[0]) {
      leadImage = inlineImages[0];
    }

    // Convert HTML to plain text while preserving paragraph structure
    // Use article.content (HTML) not textContent (strips all formatting)
    let cleanContent = article.content || '';

    // Convert block elements to paragraph breaks BEFORE stripping tags
    cleanContent = cleanContent
      .replace(/<\/p>/gi, '\n\n')                                    // End of paragraph
      .replace(/<br\s*\/?>/gi, '\n')                                 // Line breaks
      .replace(/<\/h[1-6]>/gi, '\n\n')                               // End of headers
      .replace(/<\/li>/gi, '\n')                                     // End of list items
      .replace(/<\/blockquote>/gi, '\n\n')                           // End of blockquote
      .replace(/<\/div>/gi, '\n')                                    // End of div (sometimes used as paragraphs)
      .replace(/<[^>]+>/g, '')                                       // Strip all remaining HTML tags
      .replace(/&nbsp;/g, ' ')                                       // Convert nbsp to space
      .replace(/&amp;/g, '&')                                        // Decode common entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))  // Numeric entities
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/<a\s+href="[^"]*media2\.dev\.to[^"]*"[^>]*>/gi, '')  // Remove broken dev.to links
      .replace(/https?:\/\/media2\.dev\.to[^\s)>\]]+/gi, '')         // Remove leaked dev.to URLs
      .replace(/[ \t]+/g, ' ')                                       // Normalize horizontal whitespace only
      .replace(/\n /g, '\n')                                         // Remove leading spaces after newlines
      .replace(/ \n/g, '\n')                                         // Remove trailing spaces before newlines
      .replace(/\n{3,}/g, '\n\n')                                    // Max 2 consecutive newlines
      .trim();

    // NO content limit at scrape time - store the full article
    // Truncation happens at display time in the frontend

    return {
      title: article.title || null,
      content: cleanContent || null,
      excerpt: article.excerpt || null,
      byline: article.byline || null,
      siteName: article.siteName || null,
      length: article.length || null,
      leadImage,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log(`  → Scrape timeout for ${url}`);
    } else {
      console.log(`  → Scrape error for ${url}:`, err.message);
    }
    return null;
  }
}

interface EnrichedContent {
  content: string | undefined;
  mediaUrl: string | undefined;
}

/**
 * Get the best content for a harvested item:
 * 1. For known article domains (dev.to, medium, etc), ALWAYS scrape full content
 * 2. For other URLs, scrape if we need content (<200 chars) or image
 * 3. Fall back to whatever we have
 */
export async function enrichContent(
  existingContent: string | undefined,
  linkUrl: string | undefined,
  title: string,
  existingMediaUrl?: string | undefined
): Promise<EnrichedContent> {
  let content = existingContent;
  let mediaUrl = existingMediaUrl;

  // Check if this is an article domain that we should ALWAYS scrape for full content
  const isArticleDomain = linkUrl ? ARTICLE_DOMAINS.some(d => linkUrl.includes(d)) : false;

  // For article domains, always scrape (RSS feeds only have excerpts)
  // For other domains, only scrape if existing content is short
  const needsContent = isArticleDomain || !existingContent || existingContent.length < 200;
  const needsImage = !existingMediaUrl;

  // If we have a link and need content or image, try to scrape
  if (linkUrl && isScrapeable(linkUrl) && (needsContent || needsImage)) {
    console.log(`  → Scraping: ${linkUrl.slice(0, 60)}...`);
    const article = await scrapeArticle(linkUrl);

    if (article) {
      // Use scraped content if we need it - NO LIMIT, store full article
      if (needsContent && article.content && article.content.length > 100) {
        content = article.content;
      }

      // Use scraped image if we need it
      if (needsImage && article.leadImage) {
        mediaUrl = article.leadImage;
      }
    }
  }

  return { content, mediaUrl };
}
