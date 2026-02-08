import type { PrismaClient, LinkedAccount } from '@prisma/client';
import { encryptToken, decryptToken } from '../lib/tokenEncryption.js';

const BLUESKY_PDS = 'https://bsky.social';

// ============================================
// Bluesky Session Management
// ============================================

interface BlueskySession {
  accessJwt: string;
  refreshJwt: string;
  did: string;
  handle: string;
}

export async function createBlueskySession(
  handle: string,
  appPassword: string
): Promise<BlueskySession> {
  const response = await fetch(`${BLUESKY_PDS}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bluesky auth failed: ${response.status} ${error}`);
  }

  const data = await response.json() as BlueskySession;
  return data;
}

async function refreshBlueskySession(refreshJwt: string): Promise<BlueskySession> {
  const response = await fetch(`${BLUESKY_PDS}/xrpc/com.atproto.server.refreshSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${refreshJwt}` },
  });

  if (!response.ok) {
    throw new Error(`Bluesky token refresh failed: ${response.status}`);
  }

  return response.json() as Promise<BlueskySession>;
}

export async function getBlueskyToken(
  account: LinkedAccount,
  prisma: PrismaClient
): Promise<{ token: string; did: string }> {
  const did = account.platformUserId;

  // Check if token is still valid (refresh 5 min before expiry)
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return { token: decryptToken(account.accessTokenEnc), did };
  }

  // Token expired or expiring soon — refresh
  if (!account.refreshTokenEnc) {
    throw new Error('Bluesky account has no refresh token — please reconnect');
  }

  const refreshJwt = decryptToken(account.refreshTokenEnc);
  const session = await refreshBlueskySession(refreshJwt);

  // Update stored tokens
  await prisma.linkedAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEnc: encryptToken(session.accessJwt),
      refreshTokenEnc: encryptToken(session.refreshJwt),
      tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // ~2h
      lastUsedAt: new Date(),
      lastError: null,
    },
  });

  return { token: session.accessJwt, did };
}

// ============================================
// Bluesky Interactions
// ============================================

export async function blueskyLike(
  token: string,
  did: string,
  postUri: string,
  postCid: string
): Promise<{ uri: string }> {
  const response = await fetch(`${BLUESKY_PDS}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.like',
      record: {
        subject: { uri: postUri, cid: postCid },
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bluesky like failed: ${response.status} ${error}`);
  }

  const data = await response.json() as { uri: string };
  return { uri: data.uri };
}

export async function blueskyUnlike(
  token: string,
  did: string,
  recordUri: string
): Promise<void> {
  // Extract rkey from AT URI: at://did/app.bsky.feed.like/rkey
  const rkey = recordUri.split('/').pop();
  if (!rkey) throw new Error('Invalid record URI');

  const response = await fetch(`${BLUESKY_PDS}/xrpc/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.like',
      rkey,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bluesky unlike failed: ${response.status} ${error}`);
  }
}

export async function blueskyRepost(
  token: string,
  did: string,
  postUri: string,
  postCid: string
): Promise<{ uri: string }> {
  const response = await fetch(`${BLUESKY_PDS}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.repost',
      record: {
        subject: { uri: postUri, cid: postCid },
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bluesky repost failed: ${response.status} ${error}`);
  }

  const data = await response.json() as { uri: string };
  return { uri: data.uri };
}

export async function blueskyUnrepost(
  token: string,
  did: string,
  recordUri: string
): Promise<void> {
  const rkey = recordUri.split('/').pop();
  if (!rkey) throw new Error('Invalid record URI');

  const response = await fetch(`${BLUESKY_PDS}/xrpc/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.repost',
      rkey,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bluesky unrepost failed: ${response.status} ${error}`);
  }
}

export async function blueskyReply(
  token: string,
  did: string,
  parentUri: string,
  parentCid: string,
  rootUri: string,
  rootCid: string,
  text: string
): Promise<void> {
  const response = await fetch(`${BLUESKY_PDS}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.post',
      record: {
        text,
        reply: {
          root: { uri: rootUri, cid: rootCid },
          parent: { uri: parentUri, cid: parentCid },
        },
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bluesky reply failed: ${response.status} ${error}`);
  }
}

// ============================================
// Mastodon OAuth
// ============================================

interface MastodonApp {
  client_id: string;
  client_secret: string;
}

export async function registerMastodonApp(
  instanceUrl: string,
  redirectUri: string
): Promise<MastodonApp> {
  const response = await fetch(`${instanceUrl}/api/v1/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Node Social',
      redirect_uris: redirectUri,
      scopes: 'read write',
      website: 'https://node-social.com',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mastodon app registration failed: ${response.status} ${error}`);
  }

  return response.json() as Promise<MastodonApp>;
}

export async function exchangeMastodonCode(
  instanceUrl: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{ access_token: string; scope: string }> {
  const response = await fetch(`${instanceUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      scope: 'read write',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mastodon token exchange failed: ${response.status} ${error}`);
  }

  return response.json() as Promise<{ access_token: string; scope: string }>;
}

export async function getMastodonUser(
  instanceUrl: string,
  token: string
): Promise<{ id: string; acct: string; display_name: string }> {
  const response = await fetch(`${instanceUrl}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Mastodon verify_credentials failed: ${response.status}`);
  }

  return response.json() as Promise<{ id: string; acct: string; display_name: string }>;
}

// ============================================
// Mastodon Interactions
// ============================================

export async function mastodonLike(
  instanceUrl: string,
  token: string,
  statusId: string
): Promise<void> {
  const response = await fetch(`${instanceUrl}/api/v1/statuses/${statusId}/favourite`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mastodon like failed: ${response.status} ${error}`);
  }
}

export async function mastodonUnlike(
  instanceUrl: string,
  token: string,
  statusId: string
): Promise<void> {
  const response = await fetch(`${instanceUrl}/api/v1/statuses/${statusId}/unfavourite`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mastodon unlike failed: ${response.status} ${error}`);
  }
}

export async function mastodonBoost(
  instanceUrl: string,
  token: string,
  statusId: string
): Promise<void> {
  const response = await fetch(`${instanceUrl}/api/v1/statuses/${statusId}/reblog`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mastodon boost failed: ${response.status} ${error}`);
  }
}

export async function mastodonUnboost(
  instanceUrl: string,
  token: string,
  statusId: string
): Promise<void> {
  const response = await fetch(`${instanceUrl}/api/v1/statuses/${statusId}/unreblog`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mastodon unboost failed: ${response.status} ${error}`);
  }
}

export async function mastodonReply(
  instanceUrl: string,
  token: string,
  statusId: string,
  text: string
): Promise<void> {
  const response = await fetch(`${instanceUrl}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: text,
      in_reply_to_id: statusId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mastodon reply failed: ${response.status} ${error}`);
  }
}

// ============================================
// Helpers
// ============================================

export function getMastodonToken(account: LinkedAccount): string {
  return decryptToken(account.accessTokenEnc);
}

export function extractMastodonStatusId(externalId: string, platformStatusId?: string): string {
  // If platformStatusId is provided directly, use it
  if (platformStatusId) return platformStatusId;

  // Try to extract from ActivityPub URI: https://instance/users/user/statuses/12345
  const statusMatch = externalId.match(/\/statuses\/(\d+)/);
  if (statusMatch?.[1]) return statusMatch[1];

  // Try URL format: https://instance/@user/12345
  const urlMatch = externalId.match(/\/@[^/]+\/(\d+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  throw new Error(`Cannot extract Mastodon status ID from: ${externalId}`);
}

export function extractMastodonInstance(account: LinkedAccount): string {
  if (account.instanceUrl) return account.instanceUrl;

  // Fallback: extract from handle (user@instance.tld)
  const parts = account.handle.split('@');
  if (parts.length >= 2) return `https://${parts[parts.length - 1]}`;

  throw new Error('Cannot determine Mastodon instance URL');
}
