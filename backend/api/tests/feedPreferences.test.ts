// tests/feedPreferences.test.ts
// TDD: Tests for full Vibe Validator settings persistence

import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { getTestApp, closeTestApp, makeRequest } from './setup.js';

// Helper to create a test user and get auth token
async function createTestUser(suffix: string = ''): Promise<string> {
  const email = `vibetest${suffix}${Date.now()}@test.com`;
  const response = await makeRequest('POST', '/auth/register', {
    body: {
      email,
      password: 'TestPassword123!',
      username: `vibetest${suffix}${Date.now()}`,
      firstName: 'Vibe',
      lastName: 'Tester',
      dateOfBirth: '1990-01-01T00:00:00.000Z', // ISO datetime format
    },
  });

  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`Failed to create test user: ${JSON.stringify(response.body)}`);
  }

  return response.body.token;
}

describe('Feed Preferences API', () => {
  afterAll(async () => {
    await closeTestApp();
  });

  describe('GET /feed-preferences', () => {
    it('returns default preferences for new user', async () => {
      const token = await createTestUser('get1');
      const response = await makeRequest('GET', '/feed-preferences', { token });

      expect(response.status).toBe(200);
      expect(response.body.qualityWeight).toBe(35.0);
      expect(response.body.recencyWeight).toBe(30.0);
      expect(response.body.engagementWeight).toBe(20.0);
      expect(response.body.personalizationWeight).toBe(15.0);
      expect(response.body.presetMode).toBe('balanced');
    });

    it('returns 401 without auth token', async () => {
      const response = await makeRequest('GET', '/feed-preferences');
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /feed-preferences - Basic weights', () => {
    it('saves and persists preset selection', async () => {
      const token = await createTestUser('preset1');

      // Set to "latest" preset
      const updateResponse = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: { preset: 'latest' },
      });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.presetMode).toBe('latest');
      expect(updateResponse.body.recencyWeight).toBe(80); // Latest preset has 80 recency

      // Verify it persists
      const getResponse = await makeRequest('GET', '/feed-preferences', { token });
      expect(getResponse.body.presetMode).toBe('latest');
      expect(getResponse.body.recencyWeight).toBe(80);
    });

    it('saves custom weights when they sum to 100', async () => {
      const token = await createTestUser('custom1');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: {
          preset: 'custom',
          qualityWeight: 40,
          recencyWeight: 30,
          engagementWeight: 20,
          personalizationWeight: 10,
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.qualityWeight).toBe(40);
      expect(response.body.recencyWeight).toBe(30);
      expect(response.body.engagementWeight).toBe(20);
      expect(response.body.personalizationWeight).toBe(10);
      expect(response.body.presetMode).toBe('custom');
    });

    it('rejects weights that do not sum to 100', async () => {
      const token = await createTestUser('invalid1');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: {
          preset: 'custom',
          qualityWeight: 50,
          recencyWeight: 50,
          engagementWeight: 50,
          personalizationWeight: 50,
        },
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('sum to 100');
    });
  });

  describe('PUT /feed-preferences - Intermediate settings', () => {
    it('saves timeRange setting', async () => {
      const token = await createTestUser('int1');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: { timeRange: '1h' },
      });

      expect(response.status).toBe(200);
      expect(response.body.timeRange).toBe('1h');

      // Verify persistence
      const getResponse = await makeRequest('GET', '/feed-preferences', { token });
      expect(getResponse.body.timeRange).toBe('1h');
    });

    it('saves discoveryRate setting (0-100)', async () => {
      const token = await createTestUser('int2');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: { discoveryRate: 25 },
      });

      expect(response.status).toBe(200);
      expect(response.body.discoveryRate).toBe(25);
    });

    it('rejects discoveryRate outside 0-100 range', async () => {
      const token = await createTestUser('int3');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: { discoveryRate: 150 },
      });

      expect(response.status).toBe(400);
    });

    it('saves filter toggles (hideMutedWords, showSeenPosts, etc)', async () => {
      const token = await createTestUser('int4');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: {
          hideMutedWords: false,
          showSeenPosts: true,
          textOnly: true,
          mediaOnly: false,
          linksOnly: false,
          hasDiscussion: true,
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.hideMutedWords).toBe(false);
      expect(response.body.showSeenPosts).toBe(true);
      expect(response.body.textOnly).toBe(true);
      expect(response.body.hasDiscussion).toBe(true);
    });
  });

  describe('PUT /feed-preferences - Advanced settings', () => {
    it('saves quality sub-signals', async () => {
      const token = await createTestUser('adv1');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: {
          authorCredWeight: 60,
          vectorQualityWeight: 25,
          confidenceWeight: 15,
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.authorCredWeight).toBe(60);
      expect(response.body.vectorQualityWeight).toBe(25);
      expect(response.body.confidenceWeight).toBe(15);
    });

    it('saves recency sub-signals', async () => {
      const token = await createTestUser('adv2');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: {
          timeDecay: 60,
          velocity: 25,
          freshness: 15,
          halfLifeHours: 48,
          decayFunction: 'linear',
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.timeDecay).toBe(60);
      expect(response.body.velocity).toBe(25);
      expect(response.body.freshness).toBe(15);
      expect(response.body.halfLifeHours).toBe(48);
      expect(response.body.decayFunction).toBe('linear');
    });

    it('saves engagement sub-signals', async () => {
      const token = await createTestUser('adv3');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: {
          intensity: 50,
          discussionDepth: 25,
          shareWeight: 15,
          expertCommentBonus: 10,
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.intensity).toBe(50);
      expect(response.body.discussionDepth).toBe(25);
      expect(response.body.shareWeight).toBe(15);
      expect(response.body.expertCommentBonus).toBe(10);
    });

    it('saves personalization sub-signals', async () => {
      const token = await createTestUser('adv4');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: {
          followingWeight: 50,
          alignment: 20,
          affinity: 15,
          trustNetwork: 15,
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.followingWeight).toBe(50);
      expect(response.body.alignment).toBe(20);
      expect(response.body.affinity).toBe(15);
      expect(response.body.trustNetwork).toBe(15);
    });

    it('saves vector multipliers', async () => {
      const token = await createTestUser('adv5');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: {
          vectorMultipliers: {
            insightful: 150,
            joy: 100,
            fire: 120,
            support: 100,
            shock: 50,
            questionable: 25,
          },
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.vectorMultipliers.insightful).toBe(150);
      expect(response.body.vectorMultipliers.joy).toBe(100);
      expect(response.body.vectorMultipliers.fire).toBe(120);
      expect(response.body.vectorMultipliers.shock).toBe(50);
      expect(response.body.vectorMultipliers.questionable).toBe(25);
    });

    it('saves antiAlignmentPenalty', async () => {
      const token = await createTestUser('adv6');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: { antiAlignmentPenalty: 30 },
      });

      expect(response.status).toBe(200);
      expect(response.body.antiAlignmentPenalty).toBe(30);
    });
  });

  describe('PUT /feed-preferences - Expert settings', () => {
    it('saves diversity controls', async () => {
      const token = await createTestUser('exp1');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: {
          maxPostsPerAuthor: 2,
          topicClusteringPenalty: 30,
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.maxPostsPerAuthor).toBe(2);
      expect(response.body.topicClusteringPenalty).toBe(30);
    });

    it('saves content type ratios', async () => {
      const token = await createTestUser('exp2');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: {
          textRatio: 40,
          imageRatio: 30,
          videoRatio: 20,
          linkRatio: 10,
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.textRatio).toBe(40);
      expect(response.body.imageRatio).toBe(30);
      expect(response.body.videoRatio).toBe(20);
      expect(response.body.linkRatio).toBe(10);
    });

    it('saves exploration and mood settings', async () => {
      const token = await createTestUser('exp3');

      const response = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: {
          explorationPool: 'network',
          moodToggle: 'chill',
          enableExperiments: true,
          timeBasedProfiles: true,
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.explorationPool).toBe('network');
      expect(response.body.moodToggle).toBe('chill');
      expect(response.body.enableExperiments).toBe(true);
      expect(response.body.timeBasedProfiles).toBe(true);
    });
  });

  describe('Full settings round-trip', () => {
    it('saves and retrieves all settings together', async () => {
      const token = await createTestUser('full1');

      const fullSettings = {
        // Basic
        preset: 'custom',
        qualityWeight: 40,
        recencyWeight: 25,
        engagementWeight: 20,
        personalizationWeight: 15,

        // Intermediate
        timeRange: '6h',
        discoveryRate: 20,
        hideMutedWords: true,
        showSeenPosts: false,
        textOnly: false,
        mediaOnly: false,
        linksOnly: false,
        hasDiscussion: false,

        // Advanced - Quality
        authorCredWeight: 55,
        vectorQualityWeight: 30,
        confidenceWeight: 15,

        // Advanced - Recency
        timeDecay: 55,
        velocity: 30,
        freshness: 15,
        halfLifeHours: 24,
        decayFunction: 'exponential',

        // Advanced - Engagement
        intensity: 45,
        discussionDepth: 30,
        shareWeight: 15,
        expertCommentBonus: 10,

        // Advanced - Personalization
        followingWeight: 45,
        alignment: 25,
        affinity: 20,
        trustNetwork: 10,

        // Advanced - Vector multipliers
        vectorMultipliers: {
          insightful: 120,
          joy: 100,
          fire: 110,
          support: 100,
          shock: 80,
          questionable: 50,
        },
        antiAlignmentPenalty: 25,

        // Expert
        maxPostsPerAuthor: 3,
        topicClusteringPenalty: 20,
        textRatio: 30,
        imageRatio: 30,
        videoRatio: 20,
        linkRatio: 20,
        explorationPool: 'global',
        moodToggle: 'normal',
        enableExperiments: false,
        timeBasedProfiles: false,
      };

      const updateResponse = await makeRequest('PUT', '/feed-preferences', {
        token,
        body: fullSettings,
      });

      expect(updateResponse.status).toBe(200);

      // Verify all settings persisted
      const getResponse = await makeRequest('GET', '/feed-preferences', { token });

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.qualityWeight).toBe(40);
      expect(getResponse.body.timeRange).toBe('6h');
      expect(getResponse.body.discoveryRate).toBe(20);
      expect(getResponse.body.authorCredWeight).toBe(55);
      expect(getResponse.body.halfLifeHours).toBe(24);
      expect(getResponse.body.vectorMultipliers.insightful).toBe(120);
      expect(getResponse.body.maxPostsPerAuthor).toBe(3);
      expect(getResponse.body.explorationPool).toBe('global');
    });
  });
});
