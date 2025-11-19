// src/lib/api.ts
import { API_URL } from "../config";
import { storage } from "./storage";

export type AuthResponse = {
  user: {
    id: string;
    email: string;
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
  author: {
    id: string;
    email: string;
  };
  commentCount: number;
  createdAt: string;
};

export type Comment = {
  id: string;
  content: string;
  author: {
    id: string;
    email: string;
  };
  replyCount: number;
  createdAt: string;
};

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

// Refresh the access token
async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await storage.getItem("refreshToken");
    if (!refreshToken) return null;

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // Refresh failed, clear tokens
      await storage.removeItem("token");
      await storage.removeItem("refreshToken");
      return null;
    }

    const data: RefreshResponse = await res.json();
    await storage.setItem("token", data.token);
    await storage.setItem("refreshToken", data.refreshToken);
    return data.token;
  } catch {
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

  // Add Authorization header if we have a token
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // If 401 and we haven't retried, try refreshing token once
  if (res.status === 401 && retry && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry the request with new token
      return request<T>(path, options, false);
    }
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

export function getFeed(params: { cursor?: string; limit?: number; nodeId?: string } = {}) {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.append("cursor", params.cursor);
  if (params.limit) searchParams.append("limit", params.limit.toString());
  if (params.nodeId) searchParams.append("nodeId", params.nodeId);

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
