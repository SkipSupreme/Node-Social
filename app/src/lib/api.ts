// src/lib/api.ts
import { Platform } from "react-native";
import { API_URL, resolveMediaUrl } from "../config";
import { storage } from "./storage";
import { getCookie } from "./cookies";

/**
 * React Native's FormData accepts file-like objects with uri/type/name
 * instead of Blob/File objects used on web. This interface represents
 * that native file descriptor, which must be cast for TypeScript compliance.
 */
interface NativeFileDescriptor {
  uri: string;
  type: string;
  name: string;
}

// Fields that contain media URLs and need to be resolved
const MEDIA_URL_FIELDS = ['avatar', 'banner', 'bannerImage', 'mediaUrl', 'image', 'linkImage'];

/**
 * Recursively transforms media URLs in API responses from relative to absolute.
 * Handles nested objects and arrays.
 */
function transformMediaUrls<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => transformMediaUrls(item)) as T;
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (MEDIA_URL_FIELDS.includes(key) && typeof value === 'string') {
        result[key] = resolveMediaUrl(value);
      } else if (typeof value === 'object') {
        result[key] = transformMediaUrls(value);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }

  return data;
}

export type AuthResponse = {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    createdAt: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    bio?: string;
    avatar?: string;
    bannerColor?: string;
    bannerImage?: string;
    cred?: number;
    era?: string;
    theme?: string;
    customTheme?: Record<string, unknown> | null;
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
  color?: string | null;
  avatar?: string | null;
  banner?: string | null;
  subscriberCount?: number;
  isSubscribed?: boolean;
  myRole?: string | null;
};

// Enhanced node details (from GET /nodes/:id)
export type NodeDetails = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  avatar: string | null;
  banner: string | null;
  rules: string[];
  customTheme: Record<string, unknown> | null;
  createdAt: string;
  curatorBot: {
    id: string;
    username: string;
    avatar: string | null;
    bio: string | null;
  } | null;
  stats: {
    memberCount: number;
    growthThisWeek: number;
    postCount: number;
  };
  council: {
    userId: string;
    username: string;
    avatar: string | null;
    role: string;
    joinedAt: string;
    tenure: string;
  }[];
  currentUserMembership: {
    isMember: boolean;
    role: string | null;
    joinedAt: string | null;
    isMuted: boolean;
    canEditNode: boolean;
  } | null;
  recentModActions: {
    id: string;
    action: string;
    targetType: string;
    reason: string | null;
    moderatorUsername: string;
    createdAt: string;
  }[];
};

export type ModLogAction = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  moderatorId: string | null;
  moderatorUsername: string;
  createdAt: string;
};

// TipTap JSON types for rich text content
export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

export interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

export type Post = {
  id: string;
  content: string | null;
  contentJson?: TipTapDoc | null; // TipTap JSON content
  contentFormat?: 'markdown' | 'tiptap'; // Content format type
  title?: string | null;
  author: {
    id: string;
    email: string;
    username?: string;
    avatar?: string | null;
    era?: string;
    cred?: number;
  };
  nodeId?: string | null;
  node?: Node | null; // Node information if post is in a node
  commentCount: number;
  createdAt: string;
  updatedAt?: string;
  linkUrl?: string | null;
  linkMeta?: {
    id: string;
    url: string;
    title?: string;
    description?: string;
    image?: string;
    domain?: string;
  } | null;
  poll?: {
    id: string;
    question: string;
    endsAt: string;
    options: {
      id: string;
      text: string;
      order: number;
      _count?: { votes: number };
    }[];
    votes?: { optionId: string }[]; // Current user's vote
  } | null;
  myReaction?: { [key: string]: number } | null;
  expertGateCred?: number | null; // Minimum cred required to comment (Expert Gate)
};

export type PollCreate = {
  question: string;
  options: string[];
  duration: number;
};

export type Comment = {
  id: string;
  content: string;
  author: {
    id: string;
    email: string;
    username?: string;
    avatar?: string | null;
  };
  parentId?: string | null;
  replyCount: number;
  createdAt: string;
  replies?: Comment[];
  myReaction?: { [key: string]: number } | null;
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

// Check if token will expire soon (within given minutes)
function isTokenExpiringSoon(token: string, withinMinutes: number = 5): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const bufferMs = withinMinutes * 60 * 1000;
    return Date.now() >= (exp - bufferMs);
  } catch {
    return true; // If we can't parse, assume expiring soon
  }
}

// Proactive token refresh - call this periodically to keep session alive
// Returns true if session is valid, false if session expired
export async function refreshTokenIfNeeded(): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) {
    return false; // No token, not logged in
  }

  // Refresh if token is expired or will expire within 5 minutes
  // Token has 15-minute expiry, proactive refresh runs every ~10 minutes
  if (isTokenExpired(token) || isTokenExpiringSoon(token, 5)) {
    const newToken = await refreshAccessToken();
    return newToken !== null;
  }

  return true; // Token is still valid
}

// Session expiry callback - set by auth store to handle logout
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredCallback(callback: () => void) {
  onSessionExpired = callback;
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
    } else {
      // On web, refresh uses httpOnly cookies — but if there's no stored access token,
      // the user was never authenticated, so don't bother calling refresh
      const storedToken = await storage.getItem("token");
      if (!storedToken) {
        isRefreshing = false;
        onRefreshed("");
        return null;
      }
    }
    const csrfToken = readCsrfToken();

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        // Only set Content-Type if we're sending a body (native app)
        // Web uses cookies so no body needed, and empty body with JSON content-type causes Fastify error
        ...(!isWeb ? { "Content-Type": "application/json" } : {}),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: isWeb ? undefined : JSON.stringify({ refreshToken }),
      credentials: isWeb ? "include" : undefined,
    });

    if (!res.ok) {
      // Refresh failed, clear tokens and trigger session expiry
      await storage.removeItem("token");
      await storage.removeItem("refreshToken");
      isRefreshing = false;
      onRefreshed(""); // Resolve queue with empty (will fail)
      // Notify auth store to handle logout
      if (onSessionExpired) {
        onSessionExpired();
      }
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
    ...(options.body ? { "Content-Type": "application/json" } : {}),
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
  // Skip refresh for auth endpoints (login/register) to avoid "Session expired" on invalid credentials
  const isAuthEndpoint = path.includes("/auth/login") || path.includes("/auth/register");

  if (res.status === 401 && retry && !isAuthEndpoint) {
    // Only attempt refresh if user had a token — unauthenticated visitors should not trigger refresh
    if (!token) {
      throw new Error("Authentication required");
    }
    const newToken = await refreshAccessToken();
    if (!newToken) {
      throw new Error("Session expired. Please sign in again.");
    }
    // Retry the request with updated cookies/token
    return request<T>(path, options, false);
  }

  // Handle CSRF token expiration — refresh sets a new csrfToken cookie, then retry
  if (res.status === 403 && retry && isWeb) {
    const body: unknown = await res.clone().json().catch(() => ({}));
    const errorMsg = typeof body === 'object' && body !== null && 'error' in body
      ? (body as Record<string, unknown>).error
      : '';
    if (errorMsg === 'Invalid CSRF token') {
      await refreshAccessToken();
      return request<T>(path, options, false);
    }
  }

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}));
    const message = (typeof body === 'object' && body !== null && 'error' in body && typeof (body as Record<string, unknown>).error === 'string')
      ? (body as Record<string, unknown>).error as string
      : `HTTP ${res.status}`;
    throw new Error(message);
  }

  // Transform media URLs from relative to absolute
  const data = await res.json();
  return transformMediaUrls(data) as T;
}

// --- Auth Endpoints ---

export function checkUsername(username: string) {
  return request<{ available: boolean }>(`/auth/check-username?username=${encodeURIComponent(username)}`, {
    method: "GET",
  });
}

export function register(
  email: string,
  password: string,
  username: string,
  firstName: string,
  lastName: string,
  dateOfBirth: string
) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, username, firstName, lastName, dateOfBirth }),
  });
}

export function updateProfile(data: {
  bio?: string;
  avatar?: string;
  bannerColor?: string;
  bannerImage?: string;
  theme?: string;
  era?: string;
  customCss?: string;
  customTheme?: Record<string, unknown>;
  location?: string;
  website?: string;
}) {
  return request<{ user: AuthResponse["user"] }>("/users/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ── Theme Marketplace API ──────────────────────────────────

export interface SharedTheme {
  id: string;
  name: string;
  description: string | null;
  tokens: Record<string, unknown>;
  authorId: string;
  author: { id: string; username: string; avatar: string | null };
  installs: number;
  rating: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getSharedThemes(sort: 'popular' | 'newest' | 'rating' = 'popular', limit = 20, cursor?: string) {
  const params = new URLSearchParams({ sort, limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return request<{ themes: SharedTheme[]; nextCursor: string | null; hasMore: boolean }>(
    `/api/v1/themes?${params.toString()}`,
    { method: 'GET' },
  );
}

export function getSharedTheme(id: string) {
  return request<SharedTheme>(`/api/v1/themes/${id}`, { method: 'GET' });
}

export function shareTheme(data: { name: string; description?: string; tokens: Record<string, unknown>; isPublic?: boolean }) {
  return request<SharedTheme>('/api/v1/themes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateSharedTheme(id: string, data: { name?: string; description?: string; tokens?: Record<string, unknown>; isPublic?: boolean }) {
  return request<SharedTheme>(`/api/v1/themes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function installTheme(id: string) {
  return request<{ success: boolean; tokens: Record<string, unknown> }>(`/api/v1/themes/${id}/install`, {
    method: 'POST',
  });
}

export function deleteSharedTheme(id: string) {
  return request<{ success: boolean }>(`/api/v1/themes/${id}`, {
    method: 'DELETE',
  });
}

export async function uploadAvatar(imageUri: string): Promise<{ success: boolean; user: AuthResponse["user"]; url: string }> {
  // Import Platform inline to avoid circular deps
  const { Platform } = await import('react-native');

  const token = await getAuthToken();
  const csrfToken = readCsrfToken();

  // Create form data
  const formData = new FormData();

  // Get file extension and mime type from URI
  // Handle both file paths and data URIs
  let fileType = 'jpg';
  if (imageUri.includes('.')) {
    const uriParts = imageUri.split('.');
    const ext = uriParts[uriParts.length - 1]?.toLowerCase().split('?')[0]; // Remove query params
    if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      fileType = ext === 'jpeg' ? 'jpg' : ext;
    }
  }
  const mimeType = fileType === 'png' ? 'image/png' : fileType === 'gif' ? 'image/gif' : fileType === 'webp' ? 'image/webp' : 'image/jpeg';

  if (Platform.OS === 'web') {
    // On web, we need to fetch the blob and create a File object
    // expo-image-picker returns a blob URL or data URI on web
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const file = new File([blob], `avatar.${fileType}`, { type: mimeType });
      formData.append('file', file);
    } catch (err) {
      console.error('Failed to process image for web upload:', err);
      throw new Error('Failed to process image');
    }
  } else {
    // On iOS/Android, use the file URI format that React Native expects
    formData.append('file', {
      uri: imageUri,
      type: mimeType,
      name: `avatar.${fileType}`,
    } satisfies NativeFileDescriptor as unknown as Blob);
  }

  const response = await fetch(`${API_URL}/api/uploads/avatar`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      // Don't set Content-Type - let the browser/RN set it with boundary
    },
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload avatar');
  }

  return response.json();
}

export async function uploadBanner(imageUri: string): Promise<{ success: boolean; user: AuthResponse["user"]; url: string }> {
  const { Platform } = await import('react-native');

  const token = await getAuthToken();
  const csrfToken = readCsrfToken();

  const formData = new FormData();

  let fileType = 'jpg';
  if (imageUri.includes('.')) {
    const uriParts = imageUri.split('.');
    const ext = uriParts[uriParts.length - 1]?.toLowerCase().split('?')[0];
    if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      fileType = ext === 'jpeg' ? 'jpg' : ext;
    }
  }
  const mimeType = fileType === 'png' ? 'image/png' : fileType === 'gif' ? 'image/gif' : fileType === 'webp' ? 'image/webp' : 'image/jpeg';

  if (Platform.OS === 'web') {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const file = new File([blob], `banner.${fileType}`, { type: mimeType });
      formData.append('file', file);
    } catch (err) {
      console.error('Failed to process image for web upload:', err);
      throw new Error('Failed to process image');
    }
  } else {
    formData.append('file', {
      uri: imageUri,
      type: mimeType,
      name: `banner.${fileType}`,
    } satisfies NativeFileDescriptor as unknown as Blob);
  }

  const response = await fetch(`${API_URL}/api/uploads/banner`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload banner');
  }

  return response.json();
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
  return request<{ user: AuthResponse["user"] }>("/users/me", {
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

export function verifyEmail(code: string) {
  return request<{ message: string; user?: AuthResponse["user"] }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ code }),
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

export function getSubscribedNodes() {
  return request<Node[]>("/nodes/subscribed", {
    method: "GET",
  });
}

export function toggleNodeSubscription(nodeId: string) {
  return request<{ subscribed: boolean; subscriberCount: number }>(`/nodes/${nodeId}/subscribe`, {
    method: "POST",
  });
}

export interface NodeMember {
  id: string;
  username: string;
  avatar: string | null;
  role: string;
  joinedAt: string;
  cred?: number;
}

export function getNodeMembers(nodeId: string, limit = 20, cursor?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.append("cursor", cursor);
  return request<{ members: NodeMember[]; nextCursor: string | null; hasMore: boolean }>(
    `/nodes/${nodeId}/members?${params}`,
    { method: "GET" }
  );
}

// Get enhanced node details with stats, council, membership
export function getNodeDetails(idOrSlug: string) {
  return request<NodeDetails>(`/nodes/${idOrSlug}`, {
    method: "GET",
  });
}

// Update node settings (admin only)
export function updateNode(nodeId: string, data: {
  name?: string;
  description?: string;
  color?: string;
  rules?: string[];
  customTheme?: Record<string, unknown> | null;
}) {
  return request<Node>(`/nodes/${nodeId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Join a node
export function joinNode(nodeId: string) {
  return request<{ success: boolean; membership: { role: string; joinedAt: string } }>(
    `/nodes/${nodeId}/join`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

// Leave a node
export function leaveNode(nodeId: string) {
  return request<{ success: boolean }>(`/nodes/${nodeId}/leave`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// Mute a node (hide from feed without leaving)
export function muteNode(nodeId: string) {
  return request<{ success: boolean; muted: boolean }>(`/nodes/${nodeId}/mute`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// Unmute a node
export function unmuteNode(nodeId: string) {
  return request<{ success: boolean; muted: boolean }>(`/nodes/${nodeId}/mute`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
}

// Get available curator bots
export type CuratorBot = {
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
};

export function getAvailableCuratorBots() {
  return request<{ bots: CuratorBot[] }>("/nodes/bots/available", {
    method: "GET",
  });
}

// Update node curator bot (admin only)
export function updateNodeCuratorBot(nodeId: string, curatorBotId: string | null) {
  return request<{ curatorBot: CuratorBot | null }>(`/nodes/${nodeId}/curator`, {
    method: "PATCH",
    body: JSON.stringify({ curatorBotId }),
  });
}

// Upload node avatar (admin only)
export async function uploadNodeAvatar(nodeId: string, imageUri: string): Promise<{ success: boolean; avatarUrl: string }> {
  const { Platform } = await import('react-native');
  const token = await storage.getItem("token");
  const csrfToken = readCsrfToken();

  const formData = new FormData();

  let fileType = 'jpg';
  if (imageUri.includes('.')) {
    const uriParts = imageUri.split('.');
    const ext = uriParts[uriParts.length - 1]?.toLowerCase().split('?')[0];
    if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      fileType = ext === 'jpeg' ? 'jpg' : ext;
    }
  }
  const mimeType = fileType === 'png' ? 'image/png' : fileType === 'gif' ? 'image/gif' : fileType === 'webp' ? 'image/webp' : 'image/jpeg';

  if (Platform.OS === 'web') {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const file = new File([blob], `node_avatar.${fileType}`, { type: mimeType });
      formData.append('file', file);
    } catch (err) {
      throw new Error('Failed to process image');
    }
  } else {
    formData.append('file', {
      uri: imageUri,
      type: mimeType,
      name: `node_avatar.${fileType}`,
    } satisfies NativeFileDescriptor as unknown as Blob);
  }

  const response = await fetch(`${API_URL}/nodes/${nodeId}/avatar`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload avatar');
  }

  return response.json();
}

// Upload node banner (admin only)
export async function uploadNodeBanner(nodeId: string, imageUri: string): Promise<{ success: boolean; bannerUrl: string }> {
  const { Platform } = await import('react-native');
  const token = await storage.getItem("token");
  const csrfToken = readCsrfToken();

  const formData = new FormData();

  let fileType = 'jpg';
  if (imageUri.includes('.')) {
    const uriParts = imageUri.split('.');
    const ext = uriParts[uriParts.length - 1]?.toLowerCase().split('?')[0];
    if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      fileType = ext === 'jpeg' ? 'jpg' : ext;
    }
  }
  const mimeType = fileType === 'png' ? 'image/png' : fileType === 'gif' ? 'image/gif' : fileType === 'webp' ? 'image/webp' : 'image/jpeg';

  if (Platform.OS === 'web') {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const file = new File([blob], `node_banner.${fileType}`, { type: mimeType });
      formData.append('file', file);
    } catch (err) {
      throw new Error('Failed to process image');
    }
  } else {
    formData.append('file', {
      uri: imageUri,
      type: mimeType,
      name: `node_banner.${fileType}`,
    } satisfies NativeFileDescriptor as unknown as Blob);
  }

  const response = await fetch(`${API_URL}/nodes/${nodeId}/banner`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload banner');
  }

  return response.json();
}

// Delete node avatar (admin only)
export function deleteNodeAvatar(nodeId: string) {
  return request<{ success: boolean }>(`/nodes/${nodeId}/avatar`, {
    method: "DELETE",
  });
}

// Delete node banner (admin only)
export function deleteNodeBanner(nodeId: string) {
  return request<{ success: boolean }>(`/nodes/${nodeId}/banner`, {
    method: "DELETE",
  });
}

// Get node mod log
export function getNodeModLog(nodeId: string, params?: { limit?: number; cursor?: string; action?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.append("limit", params.limit.toString());
  if (params?.cursor) searchParams.append("cursor", params.cursor);
  if (params?.action) searchParams.append("action", params.action);

  return request<{ actions: ModLogAction[]; nextCursor: string | null }>(
    `/nodes/${nodeId}/mod-log?${searchParams.toString()}`,
    { method: "GET" }
  );
}

// Bot management types
export type BotProfile = {
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  isBot: boolean;
};

// Update bot profile (site admin only)
export function updateBotProfile(botId: string, data: { bio?: string; avatar?: string }) {
  return request<{ bot: BotProfile }>(`/users/bots/${botId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Upload bot avatar (site admin only)
export async function uploadBotAvatar(botId: string, imageUri: string): Promise<{ success: boolean; bot: BotProfile; avatarUrl: string }> {
  const { Platform } = await import('react-native');
  const token = await storage.getItem("token");
  const csrfToken = readCsrfToken();

  const formData = new FormData();

  let fileType = 'jpg';
  if (imageUri.includes('.')) {
    const uriParts = imageUri.split('.');
    const ext = uriParts[uriParts.length - 1]?.toLowerCase().split('?')[0];
    if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      fileType = ext === 'jpeg' ? 'jpg' : ext;
    }
  }
  const mimeType = fileType === 'png' ? 'image/png' : fileType === 'gif' ? 'image/gif' : fileType === 'webp' ? 'image/webp' : 'image/jpeg';

  if (Platform.OS === 'web') {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const file = new File([blob], `bot_avatar.${fileType}`, { type: mimeType });
      formData.append('file', file);
    } catch (err) {
      throw new Error('Failed to process image');
    }
  } else {
    formData.append('file', {
      uri: imageUri,
      type: mimeType,
      name: `bot_avatar.${fileType}`,
    } satisfies NativeFileDescriptor as unknown as Blob);
  }

  const response = await fetch(`${API_URL}/users/bots/${botId}/avatar`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload bot avatar');
  }

  return response.json();
}

// --- Post Endpoints ---

export function createPost(data: {
  content?: string; // Optional for poll-only or link-only posts (legacy markdown)
  contentJson?: TipTapDoc; // Rich text content in TipTap JSON format
  nodeId?: string;
  title?: string;
  linkUrl?: string;
  linkMetaData?: { title?: string; description?: string; image?: string }; // Pre-populated metadata for external reposts
  poll?: PollCreate;
  expertGateCred?: number; // Minimum cred required to comment (Expert Gate)
}) {
  return request<Post>("/posts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function votePoll(postId: string, optionId: string) {
  return request<{ message: string }>(`/posts/${postId}/vote`, {
    method: "POST",
    body: JSON.stringify({ optionId }),
  });
}

export function getLinkPreview(url: string) {
  return request<{
    id: string;
    url: string;
    title?: string;
    description?: string;
    image?: string;
    domain?: string;
  }>("/metadata/preview", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function getFeed(params: {
  cursor?: string;
  limit?: number;
  nodeId?: string;
  postType?: string; // Single post type filter
  postTypes?: string[]; // Multiple post type filter
  preset?: string; // 'balanced', 'popular', etc.
  followingOnly?: boolean;
  qualityWeight?: number;
  recencyWeight?: number;
  engagementWeight?: number;
  personalizationWeight?: number;
  // Intermediate mode filters
  timeRange?: string; // '1h', '6h', '24h', '7d', 'all'
  textOnly?: boolean;
  mediaOnly?: boolean;
  linksOnly?: boolean;
  hasDiscussion?: boolean;
  // Content Intelligence (Tier 2)
  textDensity?: string; // 'micro', 'short', 'medium', 'long'
  mediaType?: string; // 'photo', 'video', 'gif', 'audio'
  // User Context (Tier 3)
  showSeenPosts?: boolean;
  hideMutedWords?: boolean;
  discoveryRate?: number;
  // Advanced mode - Quality sub-signals
  authorCredWeight?: number;
  vectorQualityWeight?: number;
  confidenceWeight?: number;
  // Advanced mode - Recency sub-signals
  timeDecay?: number;
  velocity?: number;
  freshness?: number;
  halfLifeHours?: number;
  decayFunction?: string;
  // Advanced mode - Engagement sub-signals
  intensity?: number;
  discussionDepth?: number;
  shareWeight?: number;
  expertCommentBonus?: number;
  // Advanced mode - Personalization sub-signals
  followingWeight?: number;
  alignment?: number;
  affinity?: number;
  trustNetwork?: number;
  // Advanced mode - Vector multipliers
  vectorMultipliers?: string; // JSON string
  antiAlignmentPenalty?: number;
  // Expert mode - Diversity controls
  maxPostsPerAuthor?: number;
  topicClusteringPenalty?: number;
  textRatio?: number;
  imageRatio?: number;
  videoRatio?: number;
  linkRatio?: number;
  moodToggle?: string;
} = {}) {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.append("cursor", params.cursor);
  if (params.limit) searchParams.append("limit", params.limit.toString());
  if (params.nodeId) searchParams.append("nodeId", params.nodeId);
  if (params.postType) searchParams.append("postType", params.postType);
  if (params.postTypes && params.postTypes.length > 0) {
    searchParams.append("postTypes", params.postTypes.join(","));
  }
  if (params.preset) searchParams.append("preset", params.preset);
  if (params.followingOnly) searchParams.append("followingOnly", "true");
  if (params.qualityWeight !== undefined) searchParams.append("qualityWeight", params.qualityWeight.toString());
  if (params.recencyWeight !== undefined) searchParams.append("recencyWeight", params.recencyWeight.toString());
  if (params.engagementWeight !== undefined) searchParams.append("engagementWeight", params.engagementWeight.toString());
  if (params.personalizationWeight !== undefined) searchParams.append("personalizationWeight", params.personalizationWeight.toString());
  // Intermediate mode filters
  if (params.timeRange && params.timeRange !== 'all') searchParams.append("timeRange", params.timeRange);
  if (params.textOnly) searchParams.append("textOnly", "true");
  if (params.mediaOnly) searchParams.append("mediaOnly", "true");
  if (params.linksOnly) searchParams.append("linksOnly", "true");
  if (params.hasDiscussion) searchParams.append("hasDiscussion", "true");
  // Content Intelligence (Tier 2)
  if (params.textDensity) searchParams.append("textDensity", params.textDensity);
  if (params.mediaType) searchParams.append("mediaType", params.mediaType);
  // User Context (Tier 3)
  if (params.showSeenPosts !== undefined) searchParams.append("showSeenPosts", params.showSeenPosts.toString());
  if (params.hideMutedWords !== undefined) searchParams.append("hideMutedWords", params.hideMutedWords.toString());
  if (params.discoveryRate !== undefined) searchParams.append("discoveryRate", params.discoveryRate.toString());
  // Advanced mode - Quality sub-signals
  if (params.authorCredWeight !== undefined) searchParams.append("authorCredWeight", params.authorCredWeight.toString());
  if (params.vectorQualityWeight !== undefined) searchParams.append("vectorQualityWeight", params.vectorQualityWeight.toString());
  if (params.confidenceWeight !== undefined) searchParams.append("confidenceWeight", params.confidenceWeight.toString());
  // Advanced mode - Recency sub-signals
  if (params.timeDecay !== undefined) searchParams.append("timeDecay", params.timeDecay.toString());
  if (params.velocity !== undefined) searchParams.append("velocity", params.velocity.toString());
  if (params.freshness !== undefined) searchParams.append("freshness", params.freshness.toString());
  if (params.halfLifeHours !== undefined) searchParams.append("halfLifeHours", params.halfLifeHours.toString());
  if (params.decayFunction) searchParams.append("decayFunction", params.decayFunction);
  // Advanced mode - Engagement sub-signals
  if (params.intensity !== undefined) searchParams.append("intensity", params.intensity.toString());
  if (params.discussionDepth !== undefined) searchParams.append("discussionDepth", params.discussionDepth.toString());
  if (params.shareWeight !== undefined) searchParams.append("shareWeight", params.shareWeight.toString());
  if (params.expertCommentBonus !== undefined) searchParams.append("expertCommentBonus", params.expertCommentBonus.toString());
  // Advanced mode - Personalization sub-signals
  if (params.followingWeight !== undefined) searchParams.append("followingWeight", params.followingWeight.toString());
  if (params.alignment !== undefined) searchParams.append("alignment", params.alignment.toString());
  if (params.affinity !== undefined) searchParams.append("affinity", params.affinity.toString());
  if (params.trustNetwork !== undefined) searchParams.append("trustNetwork", params.trustNetwork.toString());
  // Advanced mode - Vector multipliers and anti-alignment
  if (params.vectorMultipliers) searchParams.append("vectorMultipliers", params.vectorMultipliers);
  if (params.antiAlignmentPenalty !== undefined) searchParams.append("antiAlignmentPenalty", params.antiAlignmentPenalty.toString());
  // Expert mode - Diversity controls
  if (params.maxPostsPerAuthor !== undefined) searchParams.append("maxPostsPerAuthor", params.maxPostsPerAuthor.toString());
  if (params.topicClusteringPenalty !== undefined) searchParams.append("topicClusteringPenalty", params.topicClusteringPenalty.toString());
  if (params.textRatio !== undefined) searchParams.append("textRatio", params.textRatio.toString());
  if (params.imageRatio !== undefined) searchParams.append("imageRatio", params.imageRatio.toString());
  if (params.videoRatio !== undefined) searchParams.append("videoRatio", params.videoRatio.toString());
  if (params.linkRatio !== undefined) searchParams.append("linkRatio", params.linkRatio.toString());
  if (params.moodToggle) searchParams.append("moodToggle", params.moodToggle);

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

export function getComments(postId: string, params: { parentId?: string; limit?: number; all?: boolean } = {}) {
  const searchParams = new URLSearchParams();
  if (params.parentId) searchParams.append("parentId", params.parentId);
  if (params.limit) searchParams.append("limit", params.limit.toString());
  if (params.all) searchParams.append("all", "true");

  return request<Comment[]>(`/posts/${postId}/comments?${searchParams.toString()}`, {
    method: "GET",
  });
}

// --- Feed Preferences Endpoints ---
// Full Vibe Validator settings - supports Simple, Intermediate, Advanced, and Expert modes

export type VectorMultipliers = {
  insightful: number;
  joy: number;
  fire: number;
  support: number;
  shock: number;
  questionable: number;
};

export type FeedPreference = {
  userId: string;

  // Basic / Simple mode
  qualityWeight: number;
  recencyWeight: number;
  engagementWeight: number;
  personalizationWeight: number;
  presetMode: string | null;
  recencyHalfLife: string; // Legacy

  // Intermediate mode
  timeRange: string; // '1h', '6h', '24h', '7d', 'all'
  discoveryRate: number; // 0-100
  hideMutedWords: boolean;
  showSeenPosts: boolean;
  textOnly: boolean;
  mediaOnly: boolean;
  linksOnly: boolean;
  hasDiscussion: boolean;
  followingOnly: boolean;
  minCred: number | null;

  // Advanced - Quality sub-signals
  authorCredWeight: number;
  vectorQualityWeight: number;
  confidenceWeight: number;

  // Advanced - Recency sub-signals
  timeDecay: number;
  velocity: number;
  freshness: number;
  halfLifeHours: number;
  decayFunction: string; // 'exponential', 'linear', 'step'

  // Advanced - Engagement sub-signals
  intensity: number;
  discussionDepth: number;
  shareWeight: number;
  expertCommentBonus: number;

  // Advanced - Personalization sub-signals
  followingWeight: number;
  alignment: number;
  affinity: number;
  trustNetwork: number;

  // Advanced - Vector multipliers
  vectorMultipliers: VectorMultipliers;
  antiAlignmentPenalty: number;

  // Expert mode
  maxPostsPerAuthor: number;
  topicClusteringPenalty: number;
  textRatio: number;
  imageRatio: number;
  videoRatio: number;
  linkRatio: number;
  explorationPool: string; // 'global', 'network', 'node'
  moodToggle: string; // 'normal', 'chill', 'intense', 'discovery'
  enableExperiments: boolean;
  timeBasedProfiles: boolean;

  createdAt: string;
  updatedAt: string;
};

export type FeedPreferenceUpdate = {
  // Basic / Simple mode
  preset?: "latest" | "balanced" | "popular" | "expert" | "personal" | "custom";
  qualityWeight?: number;
  recencyWeight?: number;
  engagementWeight?: number;
  personalizationWeight?: number;
  recencyHalfLife?: "1h" | "6h" | "12h" | "24h" | "7d"; // Legacy

  // Intermediate mode
  timeRange?: "1h" | "6h" | "24h" | "7d" | "all";
  discoveryRate?: number; // 0-100
  hideMutedWords?: boolean;
  showSeenPosts?: boolean;
  textOnly?: boolean;
  mediaOnly?: boolean;
  linksOnly?: boolean;
  hasDiscussion?: boolean;
  followingOnly?: boolean;
  minCred?: number | null;

  // Advanced - Quality sub-signals
  authorCredWeight?: number;
  vectorQualityWeight?: number;
  confidenceWeight?: number;

  // Advanced - Recency sub-signals
  timeDecay?: number;
  velocity?: number;
  freshness?: number;
  halfLifeHours?: number;
  decayFunction?: "exponential" | "linear" | "step";

  // Advanced - Engagement sub-signals
  intensity?: number;
  discussionDepth?: number;
  shareWeight?: number;
  expertCommentBonus?: number;

  // Advanced - Personalization sub-signals
  followingWeight?: number;
  alignment?: number;
  affinity?: number;
  trustNetwork?: number;

  // Advanced - Vector multipliers
  vectorMultipliers?: Partial<VectorMultipliers>;
  antiAlignmentPenalty?: number;

  // Expert mode
  maxPostsPerAuthor?: number;
  topicClusteringPenalty?: number;
  textRatio?: number;
  imageRatio?: number;
  videoRatio?: number;
  linkRatio?: number;
  explorationPool?: "global" | "network" | "node";
  moodToggle?: "normal" | "chill" | "intense" | "discovery";
  enableExperiments?: boolean;
  timeBasedProfiles?: boolean;
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

// --- Muted Words Endpoints (Tier 3) ---

export type MutedWord = {
  id: string;
  word: string;
  isRegex: boolean;
  createdAt: string;
};

export function getMutedWords() {
  return request<{ mutedWords: MutedWord[] }>("/muted-words", {
    method: "GET",
  });
}

export function addMutedWord(word: string, isRegex: boolean = false) {
  return request<{ mutedWord: MutedWord }>("/muted-words", {
    method: "POST",
    body: JSON.stringify({ word, isRegex }),
  });
}

export function removeMutedWord(id: string) {
  return request<{ message: string }>(`/muted-words/${id}`, {
    method: "DELETE",
  });
}

export function clearAllMutedWords() {
  return request<{ message: string }>("/muted-words", {
    method: "DELETE",
    body: JSON.stringify({ all: true }),
  });
}

// --- Post View Tracking (Tier 3) ---

export function trackPostView(postId: string, dwellTimeMs?: number, scrollDepth?: number) {
  return request<{ view: { id: string; postId: string; viewedAt: string } }>("/post-views", {
    method: "POST",
    body: JSON.stringify({ postId, dwellTimeMs, scrollDepth }),
  });
}

export function trackPostViewsBatch(postIds: string[]) {
  return request<{ message: string }>("/post-views/batch", {
    method: "POST",
    body: JSON.stringify({ postIds }),
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
  return request<{ vectors: VibeVector[] }>("/api/v1/vectors", {
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
  data: { nodeId?: string; intensities: VibeIntensities }
) {
  return request<VibeReaction>(`/api/v1/posts/${postId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createCommentReaction(
  commentId: string,
  data: { nodeId?: string; intensities: VibeIntensities }
) {
  return request<VibeReaction>(`/api/v1/comments/${commentId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getPostReactions(postId: string) {
  return request<{
    reactions: VibeReaction[];
    aggregated: AggregatedVibeReaction[];
  }>(`/api/v1/posts/${postId}`, {
    method: "GET",
  });
}

export function getCommentReactions(commentId: string) {
  return request<{
    reactions: VibeReaction[];
    aggregated: AggregatedVibeReaction[];
  }>(`/api/v1/comments/${commentId}`, {
    method: "GET",
  });
}

export function deletePostReaction(postId: string, nodeId?: string) {
  const searchParams = new URLSearchParams();
  if (nodeId) searchParams.append("nodeId", nodeId);
  return request<{ message: string }>(`/api/v1/posts/${postId}?${searchParams.toString()}`, {
    method: "DELETE",
  });
}

export function deleteCommentReaction(commentId: string, nodeId?: string) {
  const searchParams = new URLSearchParams();
  if (nodeId) searchParams.append("nodeId", nodeId);
  return request<{ message: string }>(`/api/v1/comments/${commentId}?${searchParams.toString()}`, {
    method: "DELETE",
  });
}

// External post reactions
export function createExternalPostReaction(
  externalPostId: string,
  data: { nodeId?: string; intensities: VibeIntensities }
) {
  return request<VibeReaction>(`/api/v1/external-posts/${encodeURIComponent(externalPostId)}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getExternalPostReactions(externalPostId: string) {
  return request<{
    reactions: VibeReaction[];
    aggregate: any;
    myReaction: Record<string, number> | null;
  }>(`/api/v1/external-posts/${encodeURIComponent(externalPostId)}`, {
    method: "GET",
  });
}

export function deleteExternalPostReaction(externalPostId: string, nodeId?: string) {
  const searchParams = new URLSearchParams();
  if (nodeId) searchParams.append("nodeId", nodeId);
  return request<{ message: string }>(`/api/v1/external-posts/${encodeURIComponent(externalPostId)}?${searchParams.toString()}`, {
    method: "DELETE",
  });
}

// Search
export const searchPosts = async (query: string, limit = 20, cursor?: string) => {
  const params = new URLSearchParams({
    q: query,
    limit: limit.toString(),
  });
  if (cursor) params.append('cursor', cursor);
  return request<{ posts: Post[], total: number, nextCursor?: string, hasMore: boolean }>(`/search/posts?${params.toString()}`, {
    method: 'GET'
  });
};

export type SearchUser = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  bio: string | null;
  era: string;
  cred: number;
  isBot: boolean;
  createdAt: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
};

export const searchUsers = async (query: string, limit = 20, cursor?: string) => {
  const params = new URLSearchParams({
    q: query,
    limit: limit.toString(),
  });
  if (cursor) params.append('cursor', cursor);
  return request<{ users: SearchUser[], nextCursor?: string, hasMore: boolean }>(`/search/users?${params.toString()}`, {
    method: 'GET'
  });
};

// Saved Posts
export function savePost(postId: string) {
  return request<{ saved: boolean }>(`/posts/${postId}/save`, {
    method: "POST",
    body: JSON.stringify({}),  // Empty body required for some servers
  });
}

export function getSavedPosts() {
  return request<{ posts: Post[] }>("/posts/saved", {
    method: "GET",
  });
}

// Post Management
export function deletePost(postId: string) {
  return request<{ message: string }>(`/posts/${postId}`, {
    method: "DELETE",
  });
}

export function editPost(postId: string, data: { content?: string; contentJson?: TipTapDoc; title?: string }) {
  return request<Post>(`/posts/${postId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// User Actions
export function muteUser(userId: string) {
  return request<{ muted: boolean }>(`/users/${userId}/mute`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function blockUser(userId: string) {
  return request<{ blocked: boolean }>(`/users/${userId}/block`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export type BlockedMutedUser = {
  id: string;
  username: string;
  avatar: string | null;
  era: string;
  cred: number;
  blockedAt?: string;
  mutedAt?: string;
};

export function getBlockedUsers() {
  return request<{ users: BlockedMutedUser[] }>('/users/me/blocked', {
    method: "GET",
  });
}

export function getMutedUsers() {
  return request<{ users: BlockedMutedUser[] }>('/users/me/muted', {
    method: "GET",
  });
}

// Reports
export type ReportReason = 'spam' | 'harassment' | 'hate_speech' | 'misinformation' | 'violence' | 'other';
export type ReportTargetType = 'post' | 'comment' | 'user';

export function reportContent(targetType: ReportTargetType, targetId: string, reason: ReportReason, details?: string) {
  return request<{ message: string; reportId: string }>('/api/v1/reports', {
    method: "POST",
    body: JSON.stringify({ targetType, targetId, reason, details }),
  });
}

// Notifications
export interface Notification {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  read: boolean;
  actorId?: string;
  actorUsername?: string;
  actorAvatar?: string | null;
  targetType?: string;
  targetId?: string;
}

export function getNotifications() {
  return request<{ notifications: Notification[] }>("/notifications", {
    method: "GET",
  });
}

export function markNotificationsRead() {
  return request("/notifications/read-all", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// Follow
export function followUser(userId: string) {
  return request<{ following: boolean }>(`/users/${userId}/follow`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// Cred
export function getCredHistory() {
  return request<{ transactions: { id: string; amount: number; reason: string; createdAt: string }[] }>("/users/cred/history", {
    method: "GET",
  });
}

// Get cred history for a specific user (with node breakdown)
export async function getUserCredHistory(userId: string) {
  try {
    const res = await request<{ transactions: { id: string; amount: number; reason: string; createdAt: string; node?: { id: string; name: string; slug: string } }[] }>(`/users/${userId}/cred/history`, {
      method: "GET",
    });
    return res.transactions || [];
  } catch (error) {
    // Fallback: if endpoint doesn't exist, return empty array
    return [];
  }
}

// Get user's posts
export async function getUserPosts(userId: string, limit = 10) {
  try {
    const res = await request<{ posts: Post[] }>(`/users/${userId}/posts?limit=${limit}`, {
      method: "GET",
    });
    return res.posts || [];
  } catch (error) {
    // Fallback: if endpoint doesn't exist, return empty array
    return [];
  }
}

// User profile stats
export type UserStats = {
  postsCount: number;
  commentsCount: number;
  followersCount: number;
  followingCount: number;
  reactionsReceived: number;
  nodeSubscriptions: number;
  vouchesReceived: number;
  totalVouchStake: number;
};

export async function getUserStats(userId: string): Promise<UserStats> {
  try {
    const res = await request<UserStats>(`/users/${userId}/stats`, {
      method: "GET",
    });
    return res;
  } catch (error) {
    return {
      postsCount: 0,
      commentsCount: 0,
      followersCount: 0,
      followingCount: 0,
      reactionsReceived: 0,
      nodeSubscriptions: 0,
      vouchesReceived: 0,
      totalVouchStake: 0,
    };
  }
}

// User comments for profile
export type UserComment = {
  id: string;
  content: string;
  createdAt: string;
  post: {
    id: string;
    title: string | null;
    content: string | null;
    node?: {
      id: string;
      name: string;
      slug: string;
    };
  };
};

export async function getUserComments(userId: string, limit = 10, cursor?: string): Promise<{ comments: UserComment[]; nextCursor: string | null }> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    const res = await request<{ comments: UserComment[]; nextCursor: string | null }>(`/users/${userId}/comments?${params}`, {
      method: "GET",
    });
    return res;
  } catch (error) {
    return { comments: [], nextCursor: null };
  }
}

// --- Web of Trust (Vouching) ---

export type Vouch = {
  id: string;
  voucherId: string;
  voucheeId: string;
  stake: number;
  penaltyPaid?: number; // Cred lost when revoked (50% penalty)
  active: boolean;
  createdAt: string;
  revokedAt?: string;
  voucher?: {
    id: string;
    username: string;
    avatar: string | null;
    cred: number;
  };
  vouchee?: {
    id: string;
    username: string;
    avatar: string | null;
    cred: number;
  };
};

export type VouchStats = {
  vouchesGivenCount: number;
  vouchesReceivedCount: number;
  totalStakeReceived: number;
  topVouchers: Vouch[];
  hasVouched: boolean;
  myVouchStake: number | null;
};

export function vouchForUser(userId: string, stake?: number) {
  return request<Vouch>(`/api/v1/vouch/${userId}`, {
    method: "POST",
    body: JSON.stringify({ stake }),
  });
}

export function revokeVouch(userId: string) {
  return request<{ success: boolean; vouch: Vouch; penaltyPaid: number; credReturned: number }>(`/api/v1/vouch/${userId}`, {
    method: "DELETE",
  });
}

export function getVouchesGiven() {
  return request<Vouch[]>("/api/v1/vouch/given", {
    method: "GET",
  });
}

export function getVouchesReceived() {
  return request<Vouch[]>("/api/v1/vouch/received", {
    method: "GET",
  });
}

export function getVouchStats(userId: string) {
  return request<VouchStats>(`/api/v1/vouch/user/${userId}`, {
    method: "GET",
  });
}

// --- Council of Node ---

export type CouncilMember = {
  id: string;
  username: string;
  avatar: string | null;
  cred: number;
  nodeCred: number;
  role: string;
  joinedAt: string;
  activityMultiplier: number;
  governanceWeight: number;
};

export type CouncilInfo = {
  nodeId: string;
  councilSize: number;
  activityThresholdDays: number;
  members: CouncilMember[];
  totalGovernanceWeight: number;
};

export type CouncilEligibility = {
  isSubscribed: boolean;
  isActive: boolean;
  nodeCred: number;
  activityMultiplier: number;
  governanceWeight: number;
  rank: number | null;
  totalMembers: number;
  isOnCouncil: boolean;
  credNeededForCouncil: number;
};

export function getNodeCouncil(nodeId: string) {
  return request<CouncilInfo>(`/api/v1/council/${nodeId}`, {
    method: "GET",
  });
}

export function getCouncilEligibility(nodeId: string) {
  return request<CouncilEligibility>(`/api/v1/council/${nodeId}/eligibility`, {
    method: "GET",
  });
}

// --- Node Court (Appeals) ---

export type AppealStatus = 'pending' | 'voting' | 'upheld' | 'overturned' | 'expired';

export type Appeal = {
  id: string;
  targetType: 'post' | 'comment' | 'mod_action';
  targetId: string;
  nodeId: string | null;
  appellantId: string;
  appellant?: {
    id: string;
    username: string;
    avatar: string | null;
    cred?: number;
  };
  reason: string;
  stake: number;
  jurySize: number;
  juryDeadline: string;
  status: AppealStatus;
  verdict: 'upheld' | 'overturned' | null;
  verdictReason: string | null;
  resolvedAt: string | null;
  createdAt: string;
  _count?: {
    votes: number;
    jurors: number;
  };
  isJuror?: boolean;
  hasVoted?: boolean;
  canVote?: boolean;
};

export type AppealJuror = {
  id: string;
  appealId: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    avatar: string | null;
  };
  notifiedAt: string;
  hasVoted: boolean;
};

export type AppealVote = {
  id: string;
  appealId: string;
  jurorId: string;
  juror?: {
    id: string;
    username: string;
  };
  vote: 'uphold' | 'overturn';
  reason: string | null;
  weight: number;
  createdAt: string;
};

export type JuryDuty = {
  pending: Array<AppealJuror & { appeal: Appeal }>;
  completed: Array<AppealJuror & { appeal: Appeal }>;
  total: number;
};

export function createAppeal(data: {
  targetType: 'post' | 'comment' | 'mod_action';
  targetId: string;
  nodeId?: string;
  reason: string;
  stake: number;
}) {
  return request<Appeal>("/api/v1/appeals", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listAppeals(params?: {
  status?: AppealStatus;
  targetType?: 'post' | 'comment' | 'mod_action';
  targetId?: string;
  limit?: number;
  cursor?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.targetType) searchParams.set("targetType", params.targetType);
  if (params?.targetId) searchParams.set("targetId", params.targetId);
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.cursor) searchParams.set("cursor", params.cursor);

  const query = searchParams.toString();
  return request<{ appeals: Appeal[]; nextCursor: string | null }>(
    `/api/v1/appeals${query ? `?${query}` : ""}`,
    { method: "GET" }
  );
}

export function getAppeal(appealId: string) {
  return request<Appeal & { jurors: AppealJuror[]; votes: AppealVote[] }>(
    `/api/v1/appeals/${appealId}`,
    { method: "GET" }
  );
}

export function voteOnAppeal(appealId: string, vote: 'uphold' | 'overturn', reason?: string) {
  return request<{ success: boolean; votesIn: number; totalJurors: number; allVotesIn: boolean }>(
    `/api/v1/appeals/${appealId}/vote`,
    {
      method: "POST",
      body: JSON.stringify({ vote, reason }),
    }
  );
}

export function getMyJuryDuties() {
  return request<JuryDuty>("/api/v1/appeals/my-duties", {
    method: "GET",
  });
}

export function getMyAppeals() {
  return request<Appeal[]>("/api/v1/appeals/my-appeals", {
    method: "GET",
  });
}

// Appeal constants (match backend)
export const APPEAL_CONSTANTS = {
  MIN_CRED_TO_APPEAL: 50,
  MIN_STAKE: 25,
  MAX_STAKE: 500,
  JURY_SIZE: 5,
  VOTING_PERIOD_HOURS: 48,
  MIN_JUROR_CRED: 100,
};

// ====== Trending/Discovery API ======

export type VelocitySpike = {
  vibe: string;
  vibeEmoji: string;
  percentageChange: number;
  nodeId: string;
  nodeSlug: string;
  nodeName: string;
  nodeColor: string | null;
  hashtags: string[];
};

export type RisingNode = {
  id: string;
  slug: string;
  name: string;
  avatar: string | null;
  color: string | null;
  memberCount: number;
  growthToday: number;
};

export type NodeRecommendation = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatar: string | null;
  color: string | null;
  memberCount: number;
  matchReason: string;
};

export function getTrendingVibes() {
  return request<{ spikes: VelocitySpike[]; calculatedAt: string }>("/trending/vibes", {
    method: "GET",
  });
}

export function getTrendingNodes() {
  return request<{ nodes: RisingNode[]; calculatedAt: string }>("/trending/nodes", {
    method: "GET",
  });
}

export function getDiscoverNodes() {
  return request<{ recommendations: NodeRecommendation[]; calculatedAt: string }>("/discover/nodes", {
    method: "GET",
  });
}

// ========== Messaging / Conversations ==========

export interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  participants: {
    userId: string;
    user: {
      id: string;
      username: string;
      avatar: string | null;
      firstName?: string;
      lastName?: string;
    };
  }[];
  messages?: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
  }[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

// Get all conversations for the current user
export function getConversations() {
  return request<Conversation[]>("/api/conversations", {
    method: "GET",
  });
}

// Get messages for a specific conversation
export function getConversationMessages(conversationId: string) {
  return request<Message[]>(`/api/conversations/${conversationId}`, {
    method: "GET",
  });
}

// Start or find a conversation with a user
export function startConversation(recipientId: string) {
  return request<Conversation>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ recipientId }),
  });
}

// Send a message in a conversation
export function sendMessage(conversationId: string, content: string) {
  return request<Message>(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

// ========== External Platform Feeds (Tier 5) ==========

// Default language filter for external feeds (set to 'en' for English-only)
// Set to undefined to show all languages
let externalFeedLanguage: string | undefined = 'en';

export function setExternalFeedLanguage(lang: string | undefined) {
  externalFeedLanguage = lang;
}

export function getExternalFeedLanguage(): string | undefined {
  return externalFeedLanguage;
}

export interface ExternalPost {
  id: string;
  platform: 'bluesky' | 'mastodon';
  externalId: string;
  externalUrl: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
    profileUrl: string;
  };
  content: string;
  contentHtml?: string;
  createdAt: string;
  mediaUrls: string[];
  replyCount: number;
  repostCount: number;
  likeCount: number;
  isRepost: boolean;
  repostedBy?: {
    username: string;
    displayName: string;
  };
  language?: string | null; // Detected language code
  cached?: boolean; // Whether result was from cache
  cid?: string; // Bluesky CID (needed for interactions)
  platformStatusId?: string; // Numeric status ID for Mastodon, DID for Bluesky
  vibeAggregate?: {
    insightfulSum: number;
    joySum: number;
    fireSum: number;
    supportSum: number;
    shockSum: number;
    questionableSum: number;
    totalReactors: number;
    totalIntensity: number;
    qualityScore: number;
    engagementScore: number;
  } | null;
  myReaction?: Record<string, number> | null;
  feedScore?: number;
}

export interface ExternalFeedResult {
  posts: ExternalPost[];
  nextCursor?: string;
  platform: 'bluesky' | 'mastodon';
  cached?: boolean;
}

// Bluesky feeds
export function getBlueskyDiscover(limit = 20, cursor?: string, language?: string, scored?: boolean) {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (cursor) params.append('cursor', cursor);
  const lang = language ?? externalFeedLanguage;
  if (lang) params.append('language', lang);
  if (scored) params.append('scored', 'true');
  return request<ExternalFeedResult>(`/external/bluesky/discover?${params}`, {
    method: "GET",
  });
}

export function getBlueskyFeed(feedUri?: string, limit = 20, cursor?: string, language?: string, scored?: boolean) {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (feedUri) params.append('feed', feedUri);
  if (cursor) params.append('cursor', cursor);
  const lang = language ?? externalFeedLanguage;
  if (lang) params.append('language', lang);
  if (scored) params.append('scored', 'true');
  return request<ExternalFeedResult>(`/external/bluesky/feed?${params}`, {
    method: "GET",
  });
}

export function getBlueskyUserPosts(handle: string, limit = 20, cursor?: string, language?: string, scored?: boolean) {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (cursor) params.append('cursor', cursor);
  const lang = language ?? externalFeedLanguage;
  if (lang) params.append('language', lang);
  if (scored) params.append('scored', 'true');
  return request<ExternalFeedResult>(`/external/bluesky/user/${encodeURIComponent(handle)}?${params}`, {
    method: "GET",
  });
}

// Mastodon feeds
export function getMastodonTimeline(instance = 'mastodon.social', timeline: 'public' | 'local' = 'public', limit = 20, cursor?: string, language?: string, scored?: boolean) {
  const params = new URLSearchParams({
    instance,
    timeline,
    limit: limit.toString(),
  });
  if (cursor) params.append('cursor', cursor);
  const lang = language ?? externalFeedLanguage;
  if (lang) params.append('language', lang);
  if (scored) params.append('scored', 'true');
  return request<ExternalFeedResult>(`/external/mastodon/timeline?${params}`, {
    method: "GET",
  });
}

export function getMastodonTrending(instance = 'mastodon.social', limit = 20, offset = 0, language?: string, scored?: boolean) {
  const params = new URLSearchParams({
    instance,
    limit: limit.toString(),
    offset: offset.toString(),
  });
  const lang = language ?? externalFeedLanguage;
  if (lang) params.append('language', lang);
  if (scored) params.append('scored', 'true');
  return request<ExternalFeedResult>(`/external/mastodon/trending?${params}`, {
    method: "GET",
  });
}

// Combined external feed
export function getCombinedExternalFeed(platforms: string[] = ['bluesky', 'mastodon'], limit = 20, mastodonInstance?: string, language?: string, scored?: boolean) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    platforms: platforms.join(','),
  });
  if (mastodonInstance) params.append('mastodonInstance', mastodonInstance);
  const lang = language ?? externalFeedLanguage;
  if (lang) params.append('language', lang);
  if (scored) params.append('scored', 'true');
  return request<{ posts: ExternalPost[]; platforms: string[]; scored?: boolean }>(`/external/combined?${params}`, {
    method: "GET",
  });
}

// Get available external platforms and feeds
export interface ExternalPlatformInfo {
  id: string;
  name: string;
  icon: string;
  feeds: {
    id: string;
    name: string;
    description: string;
    requiresHandle?: boolean;
  }[];
  popularInstances?: string[];
}

export function getAvailableExternalFeeds() {
  return request<{ platforms: ExternalPlatformInfo[] }>("/external/available", {
    method: "GET",
  });
}

// External post comment/reply types
export interface ExternalComment {
  id: string;
  author: {
    username: string;
    displayName: string;
    avatar: string | null;
  };
  content: string;
  createdAt: string;
  likeCount: number;
  replyCount: number;
}

export interface ExternalThreadResult {
  replies: ExternalComment[];
  platform: 'bluesky' | 'mastodon';
}

// Fetch replies to a Bluesky post
export function getBlueskyThread(postUri: string) {
  const params = new URLSearchParams({ uri: postUri });
  return request<ExternalThreadResult>(`/external/bluesky/thread?${params}`, {
    method: "GET",
  });
}

// Fetch replies to a Mastodon post
export function getMastodonThread(instance: string, statusId: string) {
  const params = new URLSearchParams({ instance, statusId });
  return request<ExternalThreadResult>(`/external/mastodon/thread?${params}`, {
    method: "GET",
  });
}

// ============================================
// Linked Accounts (Bluesky/Mastodon)
// ============================================

export interface LinkedAccountInfo {
  id: string;
  platform: 'bluesky' | 'mastodon';
  handle: string;
  platformUserId: string;
  instanceUrl?: string | null;
  active: boolean;
  lastUsedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
}

export function getLinkedAccounts() {
  return request<{ accounts: LinkedAccountInfo[] }>('/external-accounts', { method: 'GET' });
}

export function connectBluesky(handle: string, appPassword: string) {
  return request<{ success: boolean; handle: string; did: string }>('/external-accounts/bluesky/connect', {
    method: 'POST',
    body: JSON.stringify({ handle, appPassword }),
  });
}

export function initMastodonOAuth(instance: string) {
  return request<{ authUrl: string; state: string }>('/external-accounts/mastodon/init', {
    method: 'POST',
    body: JSON.stringify({ instance }),
  });
}

export function completeMastodonOAuth(code: string, state: string) {
  return request<{ success: boolean; handle: string; instance: string }>('/external-accounts/mastodon/callback', {
    method: 'POST',
    body: JSON.stringify({ code, state }),
  });
}

export function disconnectLinkedAccount(platform: string) {
  return request<{ success: boolean }>(`/external-accounts/${platform}`, { method: 'DELETE' });
}

export function externalLike(platform: string, externalId: string, cid?: string, platformStatusId?: string) {
  return request<{ success: boolean; recordUri?: string }>(`/external-accounts/${platform}/like`, {
    method: 'POST',
    body: JSON.stringify({ externalId, cid, platformStatusId }),
  });
}

export function externalUnlike(platform: string, externalId: string, recordUri?: string, platformStatusId?: string) {
  return request<{ success: boolean }>(`/external-accounts/${platform}/like`, {
    method: 'DELETE',
    body: JSON.stringify({ externalId, recordUri, platformStatusId }),
  });
}

export function externalRepost(platform: string, externalId: string, cid?: string, platformStatusId?: string) {
  return request<{ success: boolean; recordUri?: string }>(`/external-accounts/${platform}/repost`, {
    method: 'POST',
    body: JSON.stringify({ externalId, cid, platformStatusId }),
  });
}

export function externalUnrepost(platform: string, externalId: string, recordUri?: string, platformStatusId?: string) {
  return request<{ success: boolean }>(`/external-accounts/${platform}/repost`, {
    method: 'DELETE',
    body: JSON.stringify({ externalId, recordUri, platformStatusId }),
  });
}

export function externalReply(platform: string, externalId: string, text: string, cid?: string, platformStatusId?: string, rootUri?: string, rootCid?: string) {
  return request<{ success: boolean }>(`/external-accounts/${platform}/reply`, {
    method: 'POST',
    body: JSON.stringify({ externalId, cid, platformStatusId, text, rootUri, rootCid }),
  });
}

export const api = {
  get: <T>(url: string) => request<T>(url, { method: "GET" }),
  post: <T>(url: string, body: Record<string, unknown>) => request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body: Record<string, unknown>) => request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
