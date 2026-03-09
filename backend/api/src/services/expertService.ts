import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

// Define Zod schemas for validation
const RuleConditionSchema = z.object({
    field: z.string(), // e.g., 'content', 'author.cred', 'vibe.questionable'
    operator: z.enum(['contains', 'not_contains', 'equals', 'not_equals', 'gt', 'lt', 'gte', 'lte']),
    value: z.any(),
});

const RuleActionSchema = z.object({
    type: z.enum(['suppress', 'boost']),
    multiplier: z.number().optional(), // Required for boost
});

const RuleSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    enabled: z.boolean().default(true),
    condition: RuleConditionSchema,
    action: RuleActionSchema,
});

const ExpertConfigSchema = z.object({
    qualityWeight: z.number().min(0).max(100).optional(),
    recencyWeight: z.number().min(0).max(100).optional(),
    engagementWeight: z.number().min(0).max(100).optional(),
    personalizationWeight: z.number().min(0).max(100).optional(),
    // Add more advanced params here
    epsilon: z.number().min(0).max(1).optional(),
    // Diversity
    maxPostsPerAuthor: z.number().min(1).default(3),
    authorCooldown: z.number().min(0).default(5), // Posts between same author
});

export type ExpertRule = z.infer<typeof RuleSchema>;
export type ExpertConfig = z.infer<typeof ExpertConfigSchema>;

export class ExpertService {
    /**
     * Validate expert configuration
     */
    static validateConfig(config: any): ExpertConfig {
        return ExpertConfigSchema.parse(config);
    }

    /**
     * Validate rules
     */
    static validateRules(rules: any[]): ExpertRule[] {
        return z.array(RuleSchema).parse(rules);
    }

    /**
     * Evaluate a single rule against a post
     */
    static evaluateRule(post: any, rule: ExpertRule): boolean {
        if (!rule.enabled) return false;

        const { field, operator, value } = rule.condition;
        const fieldValue = this.getFieldValue(post, field);

        switch (operator) {
            case 'contains':
                return typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(String(value).toLowerCase());
            case 'not_contains':
                return typeof fieldValue === 'string' && !fieldValue.toLowerCase().includes(String(value).toLowerCase());
            case 'equals':
                return String(fieldValue) === String(value);
            case 'not_equals':
                return String(fieldValue) !== String(value);
            case 'gt':
                return Number(fieldValue) > Number(value);
            case 'lt':
                return Number(fieldValue) < Number(value);
            case 'gte':
                return Number(fieldValue) >= Number(value);
            case 'lte':
                return Number(fieldValue) <= Number(value);
            default:
                return false;
        }
    }

    /**
     * Helper to get nested field value
     */
    private static getFieldValue(obj: any, path: string): any {
        return path.split('.').reduce((o, k) => (o || {})[k], obj);
    }

    /**
     * Apply rules to a list of posts
     * Returns modified list (filtered or re-ordered)
     */
    static applyRules(posts: any[], rules: ExpertRule[]): any[] {
        // Separate rules
        const suppressionRules = rules.filter(r => r.action.type === 'suppress');
        const boostRules = rules.filter(r => r.action.type === 'boost');

        // 1. Apply Suppression
        let filteredPosts = posts.filter(post => {
            for (const rule of suppressionRules) {
                if (this.evaluateRule(post, rule)) {
                    return false; // Suppress
                }
            }
            return true;
        });

        // 2. Apply Boosts (Modify score)
        // Note: This assumes posts have a 'score' field. If not, we might need to attach it.
        // For now, let's just attach a 'boostMultiplier' to the post object so the feed algo can use it.
        filteredPosts = filteredPosts.map(post => {
            let multiplier = 1.0;
            for (const rule of boostRules) {
                if (this.evaluateRule(post, rule)) {
                    multiplier *= (rule.action.multiplier || 1.0);
                }
            }
            return { ...post, boostMultiplier: multiplier };
        });

        return filteredPosts;
    }

    /**
     * Apply diversity rules (e.g., author cooldown)
     */
    static applyDiversity(items: any[], config: ExpertConfig, authorIdGetter: (item: any) => string = (item) => item.authorId || item.author?.id): any[] {
        const { maxPostsPerAuthor = 3, authorCooldown = 5 } = config;

        const result: any[] = [];
        const authorCounts: Record<string, number> = {};
        const recentAuthors: string[] = []; // Track last N authors for cooldown

        // We iterate through the sorted posts and pick them if they satisfy diversity constraints
        // Note: This is a greedy approach. Ideally we'd re-rank, but for MVP this works to break up clusters.
        // However, simply skipping might bury high quality content. 
        // A better approach is to "penalty" score, but we are doing this post-scoring (or pre-scoring?).
        // If we do it pre-scoring, we don't know the order.
        // If we do it post-scoring (in posts.ts), we can re-order.

        // Let's assume this is called AFTER scoring and sorting.
        // But wait, posts.ts calls applyRules BEFORE scoring.
        // Diversity should ideally be applied AFTER scoring/sorting.
        // But we can implement a simple filter here.

        // Actually, let's just implement a re-ordering logic.
        // We take the top posts and re-shuffle to satisfy constraints.

        const pool = [...items]; // Copy
        let skipped: any[] = [];

        while (pool.length > 0) {
            // Try to find the next best post that satisfies constraints
            let foundIndex = -1;

            for (let i = 0; i < Math.min(pool.length, 20); i++) { // Look ahead 20 posts
                const item = pool[i];
                const authorId = authorIdGetter(item);

                // Check max posts per author
                if ((authorCounts[authorId] || 0) >= maxPostsPerAuthor) {
                    continue;
                }

                // Check cooldown (last N posts shouldn't be same author)
                // We check the last 'authorCooldown' posts in 'result'
                const inCooldown = recentAuthors.slice(-authorCooldown).includes(authorId);
                if (inCooldown) {
                    continue;
                }

                foundIndex = i;
                break;
            }

            if (foundIndex !== -1) {
                const item = pool.splice(foundIndex, 1)[0];
                const authorId = authorIdGetter(item);

                result.push(item);
                authorCounts[authorId] = (authorCounts[authorId] || 0) + 1;
                recentAuthors.push(authorId);
            } else {
                // If no post satisfies constraints, just take the top one (graceful degradation)
                const item = pool.shift();
                const authorId = authorIdGetter(item);
                result.push(item);
                authorCounts[authorId] = (authorCounts[authorId] || 0) + 1;
                recentAuthors.push(authorId);
            }
        }

        return result;
    }
}
