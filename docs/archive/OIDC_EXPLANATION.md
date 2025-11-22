# OIDC (OpenID Connect) - What It Is & What We've Implemented

## What is OIDC?

**OIDC (OpenID Connect)** is an authentication layer built on top of **OAuth 2.0**. Think of it this way:

- **OAuth 2.0**: Authorization framework - "Can this app access my data?"
- **OIDC**: Authentication layer - "Who is this user?" + "Can this app access my data?"

### Key Differences:

| OAuth 2.0 | OIDC |
|-----------|------|
| Returns **Access Tokens** | Returns **ID Tokens** (JWT) |
| Grants permissions | Proves identity + grants permissions |
| No standard user info | Standardized user claims (sub, email, name) |
| `scope: ["profile", "email"]` | `scope: ["openid", "profile", "email"]` |

### OIDC Flow:
1. Request `openid` scope (required for OIDC)
2. Receive **ID Token** (JWT with user identity)
3. Verify ID Token signature with provider's public keys
4. Extract user claims (sub, email, name, etc.)

## What We've Implemented ✅

### **YES, we ARE using OIDC!** Here's the proof:

#### 1. **Frontend - Using ID Token Flow**
```typescript
// app/src/screens/LoginScreen.tsx
Google.useIdTokenAuthRequest({
  // This hook specifically requests ID tokens (OIDC flow)
  // It automatically includes 'openid' scope
})
```

**Key Point**: `useIdTokenAuthRequest` is specifically for OIDC:
- Automatically includes `openid` scope
- Requests ID tokens (not access tokens)
- Returns JWT with user identity claims

#### 2. **Backend - Verifying ID Tokens**
```typescript
// backend/api/src/routes/auth.ts
const ticket = await googleOAuthClient.verifyIdToken({
  idToken,  // ID Token from OIDC flow
  audience: googleAudience,
});

const payload = ticket.getPayload();
// Extracting OIDC standard claims:
// - sub (subject/user ID)
// - email
// - email_verified
// - name, picture, etc.
```

**Key Point**: We're verifying ID tokens (OIDC) not access tokens (OAuth 2.0)

#### 3. **Apple Sign-In - Also OIDC**
```typescript
// Apple also uses OIDC
const { payload } = await jwtVerify(idToken, appleJwks, {
  issuer: 'https://appleid.apple.com',
  audience: appleAudience,
});
// Extracting OIDC claims: sub, email, etc.
```

## OIDC Standard Claims We're Using

From the ID tokens, we extract these **OIDC standard claims**:

- **`sub`** (Subject) - Unique user identifier → `googleId` / `appleId`
- **`email`** - User's email address
- **`email_verified`** - Whether email is verified
- **`name`** - User's full name (Google)
- **`picture`** - User's profile picture (Google)

## Are We Fully OIDC Compliant?

### ✅ What We Have:
- Using ID tokens (OIDC flow)
- Verifying token signatures
- Extracting standard claims
- Proper audience validation
- PKCE for security

### ⚠️ What We Could Add (Optional):
- **Explicit scope declaration** - Currently implicit via `useIdTokenAuthRequest`
- **UserInfo endpoint** - We get everything from ID token, so not needed
- **Discovery endpoint** - Not required for our use case

### Should We Add Explicit Scopes?

**Current**: `useIdTokenAuthRequest` automatically includes `openid` scope

**Could add** (but not necessary):
```typescript
Google.useIdTokenAuthRequest({
  // ... existing config
  scopes: ["openid", "profile", "email"], // Explicit but redundant
})
```

**Verdict**: Not needed - `useIdTokenAuthRequest` handles it automatically!

## Summary

**YES, we've implemented OIDC!** 🎉

- ✅ Using ID tokens (OIDC)
- ✅ Verifying with provider public keys
- ✅ Extracting standard OIDC claims
- ✅ Proper security (PKCE, signature verification)

We're using **OIDC via OAuth 2.0** - the modern, secure way to authenticate users. The `useIdTokenAuthRequest` hook is specifically designed for OIDC flows, so we're already compliant!

The only thing we could add is explicit scope declaration, but it's redundant since the hook handles it automatically.

