# OIDC Architecture Comparison: Document vs Our Implementation

## ❌ **NO, we are NOT following the document's architecture**

Here are the critical differences:

## Key Architectural Differences

### 1. **Flow Type: Authorization Code vs ID Token**

| Document Requirement | Our Implementation | Status |
|---------------------|-------------------|--------|
| **Authorization Code Flow** - Client gets `code`, sends to backend, backend exchanges for tokens | **ID Token Flow** - Client gets `id_token` directly, sends to backend | ❌ **DIFFERENT** |

**Document Says:**
```typescript
// Client gets CODE
const { code } = response.params;
// Send CODE to backend
exchangeCodeForSession(code);
```

**We're Doing:**
```typescript
// Client gets ID_TOKEN directly
const token = params?.id_token;
// Send ID_TOKEN to backend
await loginWithGoogle(token);
```

### 2. **Token Exchange Location**

| Document Requirement | Our Implementation | Status |
|---------------------|-------------------|--------|
| **Backend exchanges code** - Client never sees OIDC tokens | **Client receives id_token** - Client handles OIDC tokens | ❌ **DIFFERENT** |

**Document Says:**
> "the mobile app should NEVER see the OIDC tokens. The mobile app only handles the 'code'. The actual token exchange happens on your backend."

**We're Doing:**
- Client receives `id_token` directly
- Client sends `id_token` to backend
- Backend verifies `id_token`

### 3. **Backend Token Exchange**

| Document Requirement | Our Implementation | Status |
|---------------------|-------------------|--------|
| Backend POSTs `code` + `client_secret` to provider's `token_endpoint` | Backend receives `id_token` and verifies it | ❌ **DIFFERENT** |

**Document Says:**
```javascript
// Backend exchanges code for tokens
const { tokens } = await client.getToken({
  code,
  redirect_uri
});
const idToken = tokens.id_token;
```

**We're Doing:**
```javascript
// Backend receives id_token directly
const { idToken } = parsed.data;
// Just verify it
const ticket = await googleOAuthClient.verifyIdToken({
  idToken,
  audience: googleAudience,
});
```

### 4. **Database Schema**

| Document Requirement | Our Implementation | Status |
|---------------------|-------------------|--------|
| Separate `oauth_identities` table for federation | `googleId` and `appleId` directly in `users` table | ⚠️ **DIFFERENT BUT ACCEPTABLE** |

**Document Says:**
```sql
CREATE TABLE oauth_identities (
  user_id UUID REFERENCES users(id),
  provider VARCHAR(20),
  provider_sub VARCHAR(255), -- The OIDC 'sub' claim
  UNIQUE(provider, provider_sub)
);
```

**We're Doing:**
```prisma
model User {
  googleId String? @unique // OAuth subject
  appleId  String? @unique // Apple SignIn identifier
}
```

**Note:** Our approach works but is less flexible for multiple providers per user.

## What We're Actually Using

### Current Flow (ID Token Flow):

1. **Client**: `useIdTokenAuthRequest` → Gets `id_token` directly
2. **Client**: Sends `id_token` to backend
3. **Backend**: Verifies `id_token` signature
4. **Backend**: Extracts claims (`sub`, `email`)
5. **Backend**: Creates/links user account
6. **Backend**: Issues internal session tokens

### Document's Required Flow (Authorization Code Flow):

1. **Client**: `useAuthRequest` with `responseType: 'code'` → Gets `code`
2. **Client**: Sends `code` to backend
3. **Backend**: Exchanges `code` for tokens (POST to provider's token endpoint)
4. **Backend**: Receives `id_token` + `access_token`
5. **Backend**: Verifies `id_token` signature
6. **Backend**: Extracts claims (`sub`, `email`)
7. **Backend**: Creates/links user account
8. **Backend**: Issues internal session tokens

## Security Implications

### Our Current Approach (ID Token Flow):
- ✅ Still secure (PKCE, signature verification)
- ✅ Simpler implementation
- ⚠️ Client sees OIDC tokens (less ideal)
- ⚠️ Tokens pass through client (potential interception)

### Document's Approach (Authorization Code Flow):
- ✅ More secure (client never sees tokens)
- ✅ Backend has full control
- ✅ Tokens never leave secure backend
- ⚠️ More complex implementation
- ⚠️ Requires `client_secret` on backend

## Why the Difference?

**`useIdTokenAuthRequest`** is a convenience hook that:
- Handles the OIDC flow automatically
- Gets `id_token` directly (simpler for developers)
- Still uses PKCE for security
- Still verifies tokens on backend

**`useAuthRequest` with `responseType: 'code'`** is the "pure" OIDC flow:
- Client only gets `code` (more secure)
- Backend exchanges code (full control)
- Requires `client_secret` on backend

## Should We Change?

### Arguments FOR changing to match document:
1. ✅ More secure (client never sees tokens)
2. ✅ Follows document's architecture exactly
3. ✅ Better for enterprise/sovereign architecture
4. ✅ Backend has complete control

### Arguments AGAINST changing:
1. ✅ Current approach is still secure (PKCE + verification)
2. ✅ Simpler implementation (less code)
3. ✅ Works perfectly fine for most use cases
4. ✅ `useIdTokenAuthRequest` is officially supported by Expo
5. ✅ No `client_secret` needed (public clients)

## Recommendation

**For a "sovereign" architecture** (as the document emphasizes), you should switch to Authorization Code Flow to match the document.

**For a practical, working solution**, the current ID Token Flow is acceptable and secure.

The document is more strict/enterprise-focused. Our implementation is simpler but still secure.

