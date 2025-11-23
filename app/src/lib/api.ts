// src/lib/api.ts
import { Platform } from "react-native";
import { API_URL } from "../config";
import { storage } from "./storage";
import { getCookie } from "./cookies";

export type AuthResponse = {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    createdAt: string;
  };
  token: string;
  refreshToken: string;
};

export type RefreshResponse = {
  token: string;
  refreshToken: string;
};

export type Node = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type Post = {
  id: string;
  content: string;
  title?: string | null;
  author: {
    id: string;
    email: string;
  };
  nodeId?: string | null;
  node?: Node | null; // Node information if post is in a node
  commentCount: number;
  createdAt: string;
  updatedAt?: string;
};

export type Comment = {
  id: string;
  content: string;
  author: {
    id: string;
    email: string;
  };
  parentId?: string | null;
  replyCount: number;
  createdAt: string;
};

const isWeb = Platform.OS === "web";

function readCsrfToken(): string | null {
  if (!isWeb) return null;
  return getCookie("csrfToken");
}

// Get token from storage for API requests
async function getAuthToken(): Promise<string | null> {
  return await storage.getItem("token");
}

// Check if token is expired (simple check - decode JWT exp claim)
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= exp;
  } catch {
    return true; // If we can't parse, assume expired
  }
}

// CRITICAL: Request Queue System for Thundering Herd Problem
// Per document Section 8.2 - Prevents multiple simultaneous refresh calls
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

// Add callback to the queue
const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

// Execute queue with new token
const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

// Refresh the access token
async function refreshAccessToken(): Promise<string | null> {
  // If refresh is already in progress, queue this request
  if (isRefreshing) {
    return new Promise((resolve) => {
      subscribeTokenRefresh((token) => {
        resolve(token);
      });
    });
  }

  isRefreshing = true;

  try {
    let refreshToken: string | null = null;
    if (!isWeb) {
      refreshToken = await storage.getItem("refreshToken");
      if (!refreshToken) {
        isRefreshing = false;
        onRefreshed(""); // Resolve queue with empty (will fail)
        return null;
      }
    }
    const csrfToken = readCsrfToken();

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: isWeb ? undefined : JSON.stringify({ refreshToken }),
      credentials: isWeb ? "include" : undefined,
    });

    if (!res.ok) {
      // Refresh failed, clear tokens
      await storage.removeItem("token");
      await storage.removeItem("refreshToken");
      isRefreshing = false;
      onRefreshed(""); // Resolve queue with empty (will fail)
      return null;
    }

    const data: RefreshResponse = await res.json();
    await storage.setItem("token", data.token);
    await storage.setItem("refreshToken", data.refreshToken);

    isRefreshing = false;
    onRefreshed(data.token); // Process queue with new token

    return data.token;
  } catch (error) {
    isRefreshing = false;
    onRefreshed(""); // Resolve queue with empty (will fail)
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit,
  retry = true
): Promise<T> {
  let token = await getAuthToken();

  // Check if token is expired and refresh if needed
  if (token && isTokenExpired(token)) {
    token = await refreshAccessToken();
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  const csrfToken = readCsrfToken();
  if (isWeb && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  // Add Authorization header if we have a token
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: isWeb ? "include" : options.credentials,
  });

  // If 401 and we haven't retried, try refreshing token
  // The queue system handles concurrent requests properly
  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (!newToken && !isWeb) {
      throw new Error("Session expired. Please sign in again.");
    }
    // Retry the request with updated cookies/token
    return request<T>(path, options, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as any)?.error || `HTTP ${res.status}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// --- Auth Endpoints ---

export function register(email: string, password: string) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(refreshToken?: string) {
  try {
    await request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Ignore errors on logout
  }
  // Always clear local storage
  await storage.removeItem("token");
  await storage.removeItem("refreshToken");
}

export function getMe() {
  return request<{ user: AuthResponse["user"] }>("/me", {
    method: "GET",
  });
}

export function forgotPassword(email: string) {
  return request<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string) {
  return request<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export function loginWithGoogle(idToken: string) {
  return request<AuthResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
}

export function loginWithApple(
  idToken: string,
  email?: string | null,
  fullName?: { givenName?: string | null; familyName?: string | null } | null,
  nonce?: string | null
) {
  return request<AuthResponse>("/auth/apple", {
    method: "POST",
    body: JSON.stringify({
      idToken,
      // CRITICAL: Apple only provides email/fullName on FIRST login
      // Send them if available so backend can store them
      email: email || undefined,
      fullName: fullName
        ? {
          givenName: fullName.givenName || undefined,
          familyName: fullName.familyName || undefined,
        }
        : undefined,
      // Nonce for replay protection (per document Section 6.2)
      nonce: nonce || undefined,
    }),
  });
}

export function verifyEmail(token: string) {
  return request<{ message: string; user?: AuthResponse["user"] }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function resendVerificationEmail(email: string) {
  return request<{ message: string }>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// --- Node Endpoints ---

export function getNodes() {
  return request<Node[]>("/nodes", {
    method: "GET",
  });
}

export function getNode(idOrSlug: string) {
  return request<Node>(`/nodes/${idOrSlug}`, {
    method: "GET",
  });
}

export function createNode(data: { name: string; slug: string; description?: string }) {
  return request<Node>("/nodes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Post Endpoints ---

export function createPost(data: { content: string; nodeId?: string }) {
  return request<Post>("/posts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getFeed(params: {
  cursor?: string;
  limit?: number;
  nodeId?: string;
  postType?: string; // Single post type filter
  postTypes?: string[]; // Multiple post type filter
} = {}) {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.append("cursor", params.cursor);
  if (params.limit) searchParams.append("limit", params.limit.toString());
  if (params.nodeId) searchParams.append("nodeId", params.nodeId);
  if (params.postType) searchParams.append("postType", params.postType);
  if (params.postTypes && params.postTypes.length > 0) {
    searchParams.append("postTypes", params.postTypes.join(","));
  }

  return request<{ posts: Post[]; nextCursor?: string; hasMore: boolean }>(
    `/posts?${searchParams.toString()}`,
    {
      method: "GET",
    }
  );
}

export function getPost(id: string) {
  return request<Post>(`/posts/${id}`, {
    method: "GET",
  });
}

// --- Comment Endpoints ---

export function createComment(postId: string, data: { content: string; parentId?: string }) {
  return request<Comment>(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getComments(postId: string, params: { parentId?: string; limit?: number } = {}) {
  const searchParams = new URLSearchParams();
  if (params.parentId) searchParams.append("parentId", params.parentId);
  if (params.limit) searchParams.append("limit", params.limit.toString());

  return request<Comment[]>(`/posts/${postId}/comments?${searchParams.toString()}`, {
    method: "GET",
  });
}

// --- Feed Preferences Endpoints ---

export type FeedPreference = {
  userId: string;
  qualityWeight: number;
  recencyWeight: number;
  engagementWeight: number;
  personalizationWeight: number;
  presetMode: string | null;
  recencyHalfLife: string;
  followingOnly: boolean;
  minConnoisseurCred: number | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedPreferenceUpdate = {
  preset?: "latest" | "balanced" | "popular" | "expert" | "personal" | "custom";
  qualityWeight?: number;
  recencyWeight?: number;
  engagementWeight?: number;
  personalizationWeight?: number;
  recencyHalfLife?: "1h" | "6h" | "12h" | "24h" | "7d";
  followingOnly?: boolean;
  minConnoisseurCred?: number | null;
};

export function getFeedPreferences() {
  return request<FeedPreference>("/feed-preferences", {
    method: "GET",
  });
}

export function updateFeedPreferences(data: FeedPreferenceUpdate) {
  return request<FeedPreference>("/feed-preferences", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// --- Vibe Vector Endpoints ---
// Phase 0.1 - Core feature: Vibe Vector reactions

export type VibeVector = {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
  description: string | null;
  order: number;
  enabled: boolean;
};

export type VibeIntensities = {
  [vectorSlug: string]: number; // 0.0-1.0
};

export type VibeReaction = {
  id: string;
  userId: string;
  postId: string | null;
  commentId: string | null;
  nodeId: string;
  intensities: VibeIntensities;
  totalIntensity: number;
  createdAt: string;
  user: {
    id: string;
    email: string;
  };
  node: {
    id: string;
    slug: string;
    name: string;
  };
};

export type AggregatedVibeReaction = {
  slug: string;
  name: string;
  emoji: string | null;
  totalIntensity: number;
  reactionCount: number;
};

export function getVibeVectors() {
  return request<{ vectors: VibeVector[] }>("/reactions/vectors", {
    method: "GET",
  });
}

// Get Vibe Vectors for a specific Node (with node-specific weights)
export function getVibeVectorsForNode(nodeId: string) {
  return request<VibeVector[]>(`/nodes/${nodeId}/vibe-vectors`, {
    method: "GET",
  });
}

export function createPostReaction(
  postId: string,
  data: { nodeId: string; intensities: VibeIntensities }
) {
  return request<VibeReaction>(`/reactions/posts/${postId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createCommentReaction(
  commentId: string,
  data: { nodeId: string; intensities: VibeIntensities }
) {
  return request<VibeReaction>(`/reactions/comments/${commentId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getPostReactions(postId: string) {
  return request<{
    reactions: VibeReaction[];
    aggregated: AggregatedVibeReaction[];
  }>(`/reactions/posts/${postId}`, {
    method: "GET",
  });
}

export function getCommentReactions(commentId: string) {
  return request<{
    reactions: VibeReaction[];
    aggregated: AggregatedVibeReaction[];
  }>(`/reactions/comments/${commentId}`, {
    method: "GET",
  });
}

export function deletePostReaction(postId: string, nodeId?: string) {
  const searchParams = new URLSearchParams();
  if (nodeId) searchParams.append("nodeId", nodeId);
  return request<{ message: string }>(`/reactions/posts/${postId}?${searchParams.toString()}`, {
    method: "DELETE",
  });
}

export function deleteCommentReaction(commentId: string, nodeId?: string) {
  const searchParams = new URLSearchParams();
  if (nodeId) searchParams.append("nodeId", nodeId);
  return request<{ message: string }>(`/reactions/comments/${commentId}?${searchParams.toString()}`, {
    method: "DELETE",
  });
}

// Search
export const searchPosts = async (query: string, limit = 20, offset = 0) => {
  const params = new URLSearchParams({
    q: query,
    limit: limit.toString(),
    offset: offset.toString()
  });
  return request<{ posts: Post[], total: number, hasMore: boolean }>(`/search/posts?${params.toString()}`, {
    method: 'GET'
  });
};
