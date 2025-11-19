# Building Zero-Cost Custom Auth for Expo Mobile Apps

A completely free, production-ready authentication system is achievable for React Native/Expo mobile apps with Node.js/Fastify backends. **Expo provides powerful client-side authentication tools but zero backend services**—developers must build password hashing, user management, and token generation themselves. The total cost: **$0 for unlimited users** (or $99/year if adding Apple Sign-In, which you need for iOS publishing anyway).

## The authentication reality: Expo handles the client, you build the server

Expo delivers three exceptional free packages for mobile authentication flows: expo-auth-session for OAuth, expo-secure-store for encrypted token storage, and expo-local-authentication for biometrics. These handle all client-side authentication mechanics. However, Expo provides absolutely nothing for backends—no password hashing, no user databases, no JWT generation, no session management. You must implement every server-side authentication component yourself using free open-source libraries.

The argon2id password hashing algorithm runs exclusively on your backend, never on mobile devices. When users enter passwords, your mobile app sends credentials over HTTPS to your backend API, which then hashes passwords with argon2id before storing them. This architecture is standard because password hashing is computationally expensive by design, would drain mobile batteries, and provides no security benefit if performed client-side since credentials must still be transmitted to the server for validation.

## What Expo gives you for free

### expo-auth-session: OAuth flows made simple

This client-side library handles browser-based OAuth 2.0 and OpenID Connect authentication with **automatic PKCE support** (Proof Key for Code Exchange). When you use the `useAuthRequest()` hook, Expo automatically generates the `code_verifier` and `code_challenge`, enabling secure OAuth flows without exposing client secrets in your mobile app. It supports authorization code flow with PKCE (the recommended approach) and works with any OAuth 2.0 provider—Google, Apple, GitHub, Auth0, Azure AD, AWS Cognito, and custom servers.

```javascript
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest, makeRedirectUri, useAutoDiscovery } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const discovery = useAutoDiscovery('https://accounts.google.com');
const [request, response, promptAsync] = useAuthRequest({
  clientId: 'YOUR_CLIENT_ID',
  scopes: ['openid', 'profile', 'email'],
  redirectUri: makeRedirectUri({ scheme: 'myapp' }),
  usePKCE: true, // Automatic PKCE handling
  responseType: 'code',
}, discovery);

// After OAuth success, exchange code for tokens
if (response?.type === 'success') {
  const { code } = response.params;
  // Send to your backend for validation (you must build this)
}
```

Critically, expo-auth-session is **client-side only**. It cannot securely store client secrets, doesn't handle backend token exchange, and provides no session management logic. You must build backend endpoints to validate OAuth tokens and issue your own JWTs.

### expo-secure-store: Hardware-backed encrypted storage

This provides encrypted key-value storage using native platform security—iOS Keychain Services with hardware-backed Secure Enclave encryption on iOS, and Android Keystore System with hardware encryption on Android. Each value can store up to approximately 2048 bytes, making it perfect for JWT access tokens and refresh tokens. **This is the recommended solution** for storing authentication tokens in Expo apps, far more secure than AsyncStorage which stores data unencrypted.

```javascript
import * as SecureStore from 'expo-secure-store';

// Store JWT after successful login
await SecureStore.setItemAsync('accessToken', token);
await SecureStore.setItemAsync('refreshToken', refreshToken);

// Retrieve for API calls
const token = await SecureStore.getItemAsync('accessToken');

// With biometric protection (iOS/Android)
await SecureStore.setItemAsync('sensitiveToken', token, {
  requireAuthentication: true,
  authenticationPrompt: 'Authenticate to access your token',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});
```

Important limitations: data is not preserved on app uninstall, and SecureStore is just key-value storage, not a database. You must implement all token management logic—expiration checking, refresh flows, and state management—yourself using React Context, Zustand, or Redux.

### expo-local-authentication: Native biometric authentication

This enables Face ID, Touch ID, fingerprint scanning, and device passcode authentication using native device capabilities. On iOS it supports Face ID and Touch ID with automatic device passcode fallback. On Android it supports fingerprint, face recognition, and iris scanning through the Biometric Prompt API.

```javascript
import * as LocalAuthentication from 'expo-local-authentication';

// Check device capabilities
const hasHardware = await LocalAuthentication.hasHardwareAsync();
const isEnrolled = await LocalAuthentication.isEnrolledAsync();

// Authenticate user
const result = await LocalAuthentication.authenticateAsync({
  promptMessage: 'Authenticate to login',
  fallbackLabel: 'Use password',
  disableDeviceFallback: false, // Allow passcode fallback
});

if (result.success) {
  // Retrieve stored token from SecureStore
  const token = await SecureStore.getItemAsync('authToken');
  // Proceed with authentication
}
```

Note that **Face ID is not supported in Expo Go**—you need a development build. The biometric authentication itself doesn't store credentials; you must combine it with expo-secure-store to retrieve previously stored tokens after successful biometric verification.

### Expo SDK 54: No major authentication changes

Released in September 2025 with React Native 0.81, SDK 54 brought precompiled XCFrameworks for dramatically faster iOS builds and made edge-to-edge layouts default on Android 16. However, there were no breaking changes to authentication packages—expo-auth-session, expo-secure-store, and expo-local-authentication remain stable with no major updates.

### What Expo absolutely does not provide

Expo offers **zero JWT or session management packages**. There's no built-in JWT decoding (you need the third-party `jwt-decode` library), no automatic token refresh logic, no session state management, and no backend authentication services whatsoever. You must build all of these: JWT token generation and verification on your backend, token refresh endpoints with rotation logic, session state management in React Context, token expiration handling with automatic refresh triggers, and secure token transmission over HTTPS.

## Where argon2id fits in the authentication architecture

Argon2id password hashing runs **exclusively on your backend server**, never on mobile devices. The standard authentication flow works like this:

**Registration flow:** User enters password in mobile app → App sends email and password to backend via HTTPS POST → Backend receives plain password → Backend hashes password with argon2id → Backend stores hashed password in database → Backend generates JWT tokens → Backend returns tokens to app → App stores tokens in SecureStore.

**Login flow:** User enters password in mobile app → App sends credentials to backend via HTTPS POST → Backend retrieves stored password hash from database → Backend uses argon2id to verify password against hash → If valid, backend generates new JWT tokens → Backend returns tokens to app → App stores tokens in SecureStore.

### Why argon2id must run on the backend

Password hashing algorithms like argon2id are deliberately computationally expensive to resist brute-force attacks. Running argon2id on mobile devices would drain batteries and provide inconsistent performance across device capabilities. More fundamentally, **client-side password hashing provides no security benefit** when credentials must still be transmitted to a server for validation—the server always needs to verify credentials, so hashing client-side just adds complexity without improving security. The server has consistent compute power and is the proper place for expensive cryptographic operations.

The critical security measure is transmitting passwords over **HTTPS only**, which encrypts data in transit. Once the backend receives the password through an encrypted channel, it immediately hashes it with argon2id before storing.

### Implementing argon2id with Node.js

The **`argon2` npm package** is the recommended free, open-source library for Node.js. Install with `npm install argon2`. This native module provides bindings to the reference C implementation of Argon2.

**Registration endpoint with argon2id:**

```javascript
const argon2 = require('argon2');

fastify.post('/register', async (request, reply) => {
  const { email, password, name } = request.body;
  
  // Check if user exists
  const existing = await fastify.pg.query(
    'SELECT id FROM users WHERE email = $1', [email]
  );
  
  if (existing.rows.length > 0) {
    return reply.code(409).send({ error: 'User exists' });
  }
  
  // Hash password with Argon2id
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,  // Use argon2id variant
    memoryCost: 19456,      // 19 MB memory
    timeCost: 2,            // 2 iterations
    parallelism: 1          // Single thread
  });
  
  // Store user with hashed password
  const result = await fastify.pg.query(
    `INSERT INTO users (email, password_hash, name, created_at) 
     VALUES ($1, $2, $3, NOW()) RETURNING id, email, name`,
    [email, passwordHash, name]
  );
  
  const user = result.rows[0];
  
  // Generate JWT tokens (you control expiration)
  const token = await reply.jwtSign(
    { userId: user.id, email: user.email },
    { expiresIn: '15m' }
  );
  
  const refreshToken = await reply.jwtSign(
    { userId: user.id, type: 'refresh' },
    { expiresIn: '7d' }
  );
  
  return { user, token, refreshToken };
});
```

**Login endpoint with argon2id verification:**

```javascript
fastify.post('/login', {
  config: {
    rateLimit: { max: 5, timeWindow: '15 minutes' }
  }
}, async (request, reply) => {
  const { email, password } = request.body;
  
  // Get user with password hash
  const result = await fastify.pg.query(
    'SELECT id, email, name, password_hash FROM users WHERE email = $1',
    [email]
  );
  
  if (result.rows.length === 0) {
    return reply.code(401).send({ error: 'Invalid credentials' });
  }
  
  const user = result.rows[0];
  
  // Verify password with argon2
  const isValid = await argon2.verify(user.password_hash, password);
  
  if (!isValid) {
    return reply.code(401).send({ error: 'Invalid credentials' });
  }
  
  // Generate tokens
  const token = await reply.jwtSign(
    { userId: user.id, email: user.email },
    { expiresIn: '15m' }
  );
  
  const refreshToken = await reply.jwtSign(
    { userId: user.id, type: 'refresh' },
    { expiresIn: '7d' }
  );
  
  return { user, token, refreshToken };
});
```

The argon2id parameters balance security and performance: 19MB memory cost makes GPU attacks expensive, 2 time iterations provide adequate computational cost, and single-thread parallelism works well for web servers handling concurrent requests.

## Custom backend authentication with Fastify

Building authentication from scratch with Fastify requires several free, open-source libraries that handle JWT generation, rate limiting, and password security. Every library mentioned is 100% free with no usage limits.

### @fastify/jwt: Token generation and verification

This official Fastify plugin provides JWT signing and verification, decorating Fastify instances with `jwt.sign()`, `jwt.verify()`, and `jwt.decode()` methods. It also adds `request.jwtVerify()` and `reply.jwtSign()` helpers.

```bash
npm install @fastify/jwt
```

```javascript
// Register plugin
fastify.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET,
  sign: {
    expiresIn: '15m'
  }
});

// Create authentication middleware
fastify.decorate('authenticate', async function(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// Protect routes
fastify.get('/protected', {
  onRequest: [fastify.authenticate]
}, async (request, reply) => {
  return { user: request.user };
});
```

### Rate limiting: @fastify/rate-limit vs rate-limiter-flexible

Both are free and open-source. **@fastify/rate-limit** integrates natively with Fastify and is simpler for basic rate limiting. **rate-limiter-flexible** offers advanced features like multiple storage backends (Redis, MongoDB, PostgreSQL) and progressive rate limiting.

**Recommendation:** Use **@fastify/rate-limit** for authentication endpoints—it's simpler, has native Fastify integration, and meets most auth rate limiting needs. Reserve rate-limiter-flexible for advanced DDoS protection scenarios.

```bash
npm install @fastify/rate-limit
```

```javascript
await fastify.register(require('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute'
});

// Endpoint-specific rate limiting for login
fastify.post('/login', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '15 minutes'
    }
  }
}, handler);
```

### Refresh tokens with PostgreSQL: Implementation with rotation

Refresh token rotation is critical for security—it detects token reuse attacks. When a refresh token is used, immediately issue a new one and revoke the old one. If a revoked token is presented, assume compromise and revoke all tokens for that user.

**Database schema:**

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL, -- Store hashed, not plain
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  replaced_by UUID REFERENCES refresh_tokens(id)
);

CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
```

**Refresh token endpoint with rotation:**

```javascript
const crypto = require('crypto');

fastify.post('/refresh', async (request, reply) => {
  const { refreshToken } = request.body;
  
  // Verify JWT structure
  let decoded;
  try {
    decoded = await fastify.jwt.verify(refreshToken);
  } catch (err) {
    return reply.code(401).send({ error: 'Invalid token' });
  }
  
  // Hash token for database lookup
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  
  // Check database
  const tokenResult = await fastify.pg.query(
    `SELECT id, user_id, expires_at, revoked_at 
     FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash]
  );
  
  if (tokenResult.rows.length === 0) {
    return reply.code(401).send({ error: 'Token not found' });
  }
  
  const tokenRecord = tokenResult.rows[0];
  
  // Token reuse detection
  if (tokenRecord.revoked_at) {
    // Revoke ALL tokens for this user (security breach detected)
    await fastify.pg.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() 
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [tokenRecord.user_id]
    );
    return reply.code(401).send({ error: 'Token reuse detected' });
  }
  
  // Check expiration
  if (new Date(tokenRecord.expires_at) < new Date()) {
    return reply.code(401).send({ error: 'Token expired' });
  }
  
  // Generate new tokens (rotation)
  const newToken = await reply.jwtSign(
    { userId: tokenRecord.user_id },
    { expiresIn: '15m' }
  );
  
  const newRefreshToken = await reply.jwtSign(
    { userId: tokenRecord.user_id, type: 'refresh' },
    { expiresIn: '7d' }
  );
  
  const newRefreshHash = crypto.createHash('sha256')
    .update(newRefreshToken).digest('hex');
  
  // Update database (transaction for atomicity)
  await fastify.pg.query('BEGIN');
  
  try {
    // Revoke old token
    await fastify.pg.query(
      `UPDATE refresh_tokens 
       SET revoked_at = NOW(), replaced_by = (
         SELECT id FROM refresh_tokens WHERE token_hash = $1
       )
       WHERE id = $2`,
      [newRefreshHash, tokenRecord.id]
    );
    
    // Insert new token
    await fastify.pg.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [tokenRecord.user_id, newRefreshHash]
    );
    
    await fastify.pg.query('COMMIT');
  } catch (err) {
    await fastify.pg.query('ROLLBACK');
    throw err;
  }
  
  return { token: newToken, refreshToken: newRefreshToken };
});
```

### Session management patterns for mobile apps

Mobile apps require different token strategies than web apps. **Access tokens should be short-lived** (15 minutes) to minimize damage from theft, while **refresh tokens should be long-lived** (7-30 days) to keep users logged in across app restarts. Store refresh tokens with device metadata to enable users to view and revoke sessions from different devices.

**Key mobile session patterns:**

- Store access tokens in AsyncStorage or memory (short-lived, less sensitive)
- Store refresh tokens in SecureStore (long-lived, more sensitive)
- Implement automatic token refresh when access tokens expire
- Use axios interceptors to handle 401 responses and trigger refresh
- Allow "logout all devices" by revoking all refresh tokens for a user
- Track device info (deviceId, deviceName, IP address) for security auditing

```javascript
// Device-specific refresh token creation
fastify.post('/mobile-login', async (request, reply) => {
  const { email, password, deviceId, deviceName } = request.body;
  
  // ... authenticate user ...
  
  const refreshToken = await reply.jwtSign({
    userId: user.id,
    type: 'refresh',
    device: deviceName
  }, { expiresIn: '30d' });
  
  await fastify.pg.query(
    `INSERT INTO refresh_tokens 
     (user_id, token_hash, device_id, device_name, expires_at) 
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')`,
    [user.id, hashToken(refreshToken), deviceId, deviceName]
  );
  
  return { token, refreshToken };
});
```

### Complete authentication endpoints required

Every custom authentication system needs these core endpoints:

- **POST /register** - Email/password registration with validation
- **POST /login** - Credential verification and token generation  
- **POST /refresh** - Exchange refresh token for new access token
- **POST /logout** - Revoke refresh token for current device
- **POST /logout-all** - Revoke all refresh tokens for user
- **POST /forgot-password** - Generate and email password reset token
- **POST /reset-password** - Validate token and update password
- **POST /verify-email** - Validate email verification token
- **GET /me** - Get current authenticated user info

Each endpoint requires input validation (use Zod or Joi), rate limiting (especially auth endpoints), error handling that doesn't reveal user existence, and audit logging for security events.

## Free OAuth implementation: Google and Apple

OAuth with Google and Apple enables social login while remaining completely free (except Apple's $99/year developer account required for iOS publishing anyway). Both providers offer free OAuth APIs with no per-user costs.

### Google OAuth: 100% free with unlimited users

Google's OAuth 2.0 API is completely free—no per-user charges, no API call limits for OAuth flows. The only limitation is 100 users for unverified apps, but Google app verification is a free process (though it takes time for review). You never need Google Identity Platform (Firebase Auth)—standard OAuth 2.0 with the free `google-auth-library` package is sufficient.

**Required setup (all free):**
- Google Cloud Console project (free)
- OAuth 2.0 Client IDs: Web Client ID for backend validation, Android Client ID, iOS Client ID
- Configure authorized redirect URIs

**Mobile implementation with expo-auth-session:**

```javascript
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { idToken } = response.authentication;
      
      // Send idToken to your backend for validation
      fetch('https://your-api.com/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      })
      .then(res => res.json())
      .then(async (data) => {
        // Store your custom JWT from backend
        await SecureStore.setItemAsync('accessToken', data.token);
        // Navigate to authenticated area
      });
    }
  }, [response]);

  return { signIn: () => promptAsync(), request };
}
```

**Backend validation (free with google-auth-library):**

```bash
npm install google-auth-library
```

```javascript
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

fastify.post('/auth/google', async (request, reply) => {
  const { idToken } = request.body;
  
  try {
    // Validate token with Google (FREE - no API costs)
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    
    // Extract user info from verified token
    const oauthData = {
      provider: 'google',
      providerId: payload.sub, // Unique Google ID - use as primary key
      email: payload.email,
      emailVerified: payload.email_verified,
      name: payload.name,
      picture: payload.picture,
    };
    
    // Find or create user in your database
    let user = await db.collection('users').findOne({
      'oauth.google.id': oauthData.providerId
    });
    
    if (!user) {
      user = await db.collection('users').insertOne({
        email: oauthData.email,
        name: oauthData.name,
        picture: oauthData.picture,
        oauth: {
          google: {
            id: oauthData.providerId,
            linkedAt: new Date()
          }
        },
        createdAt: new Date()
      });
    }
    
    // Generate YOUR custom JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    return { success: true, token, user };
  } catch (error) {
    reply.code(401).send({ error: 'Invalid Google token' });
  }
});
```

### Apple Sign-In: $99/year but required for iOS anyway

Apple Sign-In requires an Apple Developer Program membership at $99 USD annually. However, this is mandatory for publishing iOS apps to the App Store anyway, so it's not an additional cost. After enrollment, there are no per-user charges or API limits. Critically, **if your app includes Google Sign-In, Apple App Store guidelines require you to also offer Apple Sign-In**.

**Required setup:**
- Apple Developer Account ($99/year)
- App ID with "Sign in with Apple" capability enabled
- Service ID for web flows (optional)
- Private key (.p8 file) for backend validation

**Mobile implementation (iOS only):**

```javascript
import * as AppleAuthentication from 'expo-apple-authentication';

export async function signInWithApple() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    
    // credential contains:
    // - identityToken (JWT to send to backend)
    // - user (Apple user ID)
    // - email (ONLY on first sign-in!)
    // - fullName (ONLY on first sign-in!)
    
    // Send to backend
    const response = await fetch('https://your-api.com/auth/apple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identityToken: credential.identityToken,
        user: credential.user,
        email: credential.email,
        fullName: credential.fullName,
      })
    });
    
    const data = await response.json();
    await SecureStore.setItemAsync('accessToken', data.token);
    return data.user;
  } catch (e) {
    if (e.code === 'ERR_REQUEST_CANCELED') {
      console.log('User canceled Apple Sign-In');
    }
  }
}
```

**Backend validation (free with verify-apple-id-token):**

```bash
npm install verify-apple-id-token
```

```javascript
const verifyAppleToken = require('verify-apple-id-token').default;

fastify.post('/auth/apple', async (request, reply) => {
  const { identityToken, email, fullName } = request.body;
  
  try {
    // Validate token with Apple (FREE - no API costs)
    const jwtClaims = await verifyAppleToken({
      idToken: identityToken,
      clientId: process.env.APPLE_CLIENT_ID, // Your bundle ID
    });
    
    const oauthData = {
      provider: 'apple',
      providerId: jwtClaims.sub, // Unique Apple ID - use as primary key
      email: email || jwtClaims.email,
      emailVerified: jwtClaims.email_verified === 'true',
    };
    
    // CRITICAL: Apple only sends email/name on FIRST sign-in
    // Store them if provided, otherwise use existing data
    if (fullName) {
      oauthData.name = `${fullName.givenName} ${fullName.familyName}`;
    }
    
    // Find or create user (same pattern as Google)
    let user = await findOrCreateUser(db, oauthData);
    
    // Generate your custom JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    return { success: true, token, user };
  } catch (error) {
    reply.code(401).send({ error: 'Invalid Apple token' });
  }
});
```

### Critical OAuth gotchas and differences

**Google OAuth:**
- ✅ Returns full user data on every sign-in
- ✅ Works on iOS, Android, and web
- ⚠️ Requires app verification for 100+ users (free but takes time)

**Apple Sign-In:**
- ⚠️ **Email and name sent ONLY on first sign-in** - you must save them immediately
- ⚠️ iOS only (no Android support)
- ⚠️ Users can enable "Hide My Email" with private relay addresses
- ✅ Native UI provides excellent user experience on iOS
- ✅ Required by App Store if you offer other social login options

The complete OAuth flow: User taps sign-in button → Mobile app opens OAuth provider (browser for Google, native modal for Apple) → User authenticates → Provider returns tokens → App sends tokens to backend → Backend validates with provider's public keys → Backend creates/updates user in database → Backend generates custom JWT → App stores JWT in SecureStore → App uses JWT for authenticated API requests.

## Zero-cost email sending options

Email verification and password reset require sending transactional emails. Several options exist, but most "free tiers" are either too limited or time-limited.

### Resend: The best completely free production option

**Resend offers 3,000 emails per month permanently free** with no credit card required and no expiration. This is sufficient for most small-to-medium apps and is specifically designed for transactional emails like authentication. The free tier includes a modern API, webhooks, analytics, multi-region support, and excellent deliverability for verification and password reset emails.

**Limitations to maintain:** Must keep bounce rate below 4% and spam rate below 0.08%. Daily limit of 100 emails. Requires domain verification.

**Setup time:** 5 minutes with straightforward documentation.

```bash
npm install resend
```

```javascript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

// Email verification
async function sendVerificationEmail(email, token, userId) {
  const verificationUrl = `${process.env.APP_URL}/verify/${userId}/${token}`;
  
  const { data, error } = await resend.emails.send({
    from: '[email protected]', // Your verified domain
    to: email,
    subject: 'Verify your email address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome! Please verify your email</h2>
        <p>Click the button below to verify your email address:</p>
        <a href="${verificationUrl}" 
           style="display: inline-block; padding: 12px 24px; background: #007bff; 
                  color: white; text-decoration: none; border-radius: 4px;">
          Verify Email
        </a>
        <p style="color: #666; margin-top: 20px;">Or copy this link:</p>
        <p style="color: #666;">${verificationUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">
          This link expires in 24 hours.
        </p>
      </div>
    `
  });

  if (error) throw new Error(`Email failed: ${error.message}`);
  return data;
}

// Password reset
async function sendPasswordResetEmail(email, token, userId) {
  const resetUrl = `${process.env.APP_URL}/reset-password/${userId}/${token}`;
  
  await resend.emails.send({
    from: '[email protected]',
    to: email,
    subject: 'Reset your password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Click the button below to reset your password:</p>
        <a href="${resetUrl}" 
           style="display: inline-block; padding: 12px 24px; background: #dc3545; 
                  color: white; text-decoration: none; border-radius: 4px;">
          Reset Password
        </a>
        <p style="color: #666; margin-top: 20px;">Or copy this link:</p>
        <p style="color: #666;">${resetUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">
          This link expires in 1 hour. If you didn't request this, ignore this email.
        </p>
      </div>
    `
  });
}
```

### Other options: Why Resend wins

**SendGrid** ended its free tier in July 2025—it now starts at $27/month, making it unsuitable for zero-cost solutions.

**AWS SES** offers 3,000 emails/month free for the first 12 months only, then charges $0.10 per 1,000 emails. It has high setup complexity requiring AWS account management and starting in sandbox mode. Only worth it if your backend is already hosted on AWS.

**Mailgun** offers 100 emails/day (3,000/month) with only 1 custom domain and 1-day log retention—adequate for testing but too limited for production.

**Postmark** offers only 100 emails/month forever free, then $15/month for 10,000 emails. Great deliverability but too limited for active apps.

**Nodemailer with Gmail** allows 500 emails per 24 hours with personal Gmail (2,000 with Google Workspace), but emails often land in spam, there's no proper SPF/DKIM/DMARC with @gmail.com addresses, and Google may block app access. Only suitable for development and testing, not production.

**Self-hosted email** is extremely impractical in 2025—most IPs are blacklisted with poor deliverability, requires complex DNS setup (SPF, DKIM, DMARC, reverse DNS), needs 24/7 maintenance, and still results in high spam folder rates. Not recommended.

## What you must build custom: The complete checklist

Expo provides client-side tools only. You must implement all backend authentication logic from scratch.

### Database schemas for PostgreSQL

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  is_email_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- Email verification tokens
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP
);

CREATE INDEX idx_verification_tokens_token ON email_verification_tokens(token);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);

-- Refresh tokens with rotation support
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  replaced_by UUID REFERENCES refresh_tokens(id),
  device_info JSONB,
  ip_address INET
);

CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
```

### Registration flow: 9 essential steps

1. **Input validation** - Email format, password strength (minimum 8 chars, uppercase, lowercase, number, special character)
2. **Duplicate check** - Query database to ensure email doesn't exist
3. **Password hashing** - Use argon2id with memoryCost 19456, timeCost 2, parallelism 1
4. **User creation** - Insert user with is_email_verified = false
5. **Token generation** - Use crypto.randomBytes(32).toString('hex')
6. **Token storage** - Store token with 24-hour expiration
7. **Email sending** - Send verification email via Resend
8. **Return success** - Don't auto-login; require email verification first
9. **Audit logging** - Record registration attempt with IP address

### Email verification flow: 5 critical steps

1. **Token validation** - Check token exists in database and matches user ID
2. **Expiration check** - Verify token created within last 24 hours
3. **Usage check** - Ensure token hasn't been used already (used_at is NULL)
4. **User update** - Set is_email_verified = true
5. **Token marking** - Set used_at = NOW() to prevent reuse

### Login flow: 11 security steps

1. **Input validation** - Email format, password presence
2. **User lookup** - Find user by email
3. **Existence check** - Return generic "invalid credentials" if not found (don't reveal existence)
4. **Verification check** - Ensure is_email_verified = true
5. **Password verification** - Use argon2.verify() to compare hashes
6. **Access token generation** - JWT with 15-minute expiration
7. **Refresh token generation** - Random 32 bytes with crypto.randomBytes()
8. **Token hashing** - SHA-256 hash before storing in database
9. **Token storage** - Insert refresh token with 7-day expiration
10. **Response** - Return both tokens plus user data (never include password_hash)
11. **Audit logging** - Record successful login with timestamp, IP, device info

### Password reset flow: Two-step process

**Step 1: Request reset**
1. Receive email from user
2. Look up user (don't reveal if exists)
3. Generate reset token with crypto.randomBytes(32)
4. Store token with 1-hour expiration
5. Send reset email via Resend
6. Always return success message regardless of whether email exists (security best practice)

**Step 2: Complete reset**
1. Validate token exists, not expired, not used
2. Validate new password strength
3. Hash new password with argon2id
4. Update user password in database
5. Mark token as used (used_at = NOW())
6. Revoke all refresh tokens (force re-login on all devices for security)
7. Send password change confirmation email
8. Return success and redirect to login

### Token refresh flow with rotation: 8 security steps

1. **Extract token** - From request body or Authorization header
2. **JWT verification** - Verify signature and expiration
3. **Hash token** - SHA-256 for database lookup
4. **Database check** - Find token record
5. **Revocation check** - If revoked_at is set, revoke ALL user tokens (detect reuse attack)
6. **Expiration check** - Verify expires_at is in future
7. **Token rotation** - Generate new access and refresh tokens
8. **Database update** - Atomically revoke old token, insert new token, link with replaced_by

### Rate limiting: Protect all authentication endpoints

```javascript
// Login: 5 attempts per 15 minutes per IP
fastify.post('/login', {
  config: { rateLimit: { max: 5, timeWindow: '15m' } }
}, handler);

// Registration: 3 attempts per hour per IP
fastify.post('/register', {
  config: { rateLimit: { max: 3, timeWindow: '1h' } }
}, handler);

// Password reset: 3 attempts per hour per email or IP
fastify.post('/forgot-password', {
  config: { rateLimit: { max: 3, timeWindow: '1h' } }
}, handler);
```

### Security best practices checklist

**Password security:**
- Never log passwords or include in responses
- Hash with argon2id only (not bcrypt for new apps in 2025)
- Enforce minimum 8 characters with complexity requirements
- Store only hashed passwords, never plaintext

**Token security:**
- Generate tokens with crypto.randomBytes(), never Math.random()
- Store refresh tokens hashed (SHA-256) in database
- Short-lived access tokens (15 minutes)
- Long-lived refresh tokens (7 days) with rotation
- Implement refresh token reuse detection
- Use URL-safe encoding (.toString('hex'))

**Input validation:**
- Use Joi or Zod schemas for all inputs
- Sanitize user inputs to prevent injection
- Use parameterized SQL queries (prevent SQL injection)
- Escape HTML in emails (prevent XSS)

**Communication security:**
- HTTPS only in production
- Properly configured CORS with @fastify/cors
- Security headers with @fastify/helmet
- Never reveal user existence in error messages

**Audit and monitoring:**
- Log all authentication events (login, logout, register, password reset)
- Record IP addresses and device info with refresh tokens
- Track failed login attempts
- Implement optional account lockout after repeated failures

## Complete zero-cost architecture

Here's the entire technology stack with specific free libraries and their roles in the authentication system.

### Mobile layer: Expo React Native

**Core packages (all free):**
- `expo-auth-session` - OAuth flows with automatic PKCE
- `expo-secure-store` - Encrypted JWT storage (iOS Keychain, Android Keystore)
- `expo-local-authentication` - Biometric authentication
- `@react-native-async-storage/async-storage` - Unencrypted storage for non-sensitive data
- `axios` - HTTP client with interceptors for automatic token refresh
- `@react-navigation/native` - Navigation between auth screens

**Token storage strategy:**
- Access tokens: AsyncStorage or memory (15-minute lifespan)
- Refresh tokens: SecureStore for hardware-backed encryption (7-day lifespan)

### Backend layer: Fastify with Node.js

**All packages are free and open-source:**
- `fastify` - High-performance web framework
- `@fastify/jwt` - JWT generation and verification
- `@fastify/cors` - Cross-origin resource sharing
- `@fastify/helmet` - Security headers (X-Frame-Options, CSP, etc.)
- `@fastify/rate-limit` - Rate limiting for auth endpoints
- `argon2` - Password hashing with argon2id
- `pg` - PostgreSQL database driver
- `resend` - Email service (3,000/month free)
- `joi` or `zod` - Input validation schemas
- `google-auth-library` - Google OAuth token validation
- `verify-apple-id-token` - Apple Sign-In token validation

**Installation command:**
```bash
npm install fastify @fastify/jwt @fastify/cors @fastify/helmet @fastify/rate-limit argon2 pg resend joi google-auth-library verify-apple-id-token
```

### Database layer: PostgreSQL

Use PostgreSQL 14+ with the schemas provided earlier. All schemas use UUIDs for primary keys, proper foreign key constraints with CASCADE deletion, indexes on frequently queried columns (email, tokens), and timestamp tracking for audit trails.

### Email service: Resend

3,000 emails/month permanently free, specifically designed for transactional emails. Requires domain verification (5-minute setup) but no credit card for free tier.

### Complete data flow: Registration to authenticated requests

**Flow 1: Registration**
User enters email/password → App validates input → App sends POST to /register → Backend validates email doesn't exist → Backend hashes password with argon2id → Backend inserts user (is_email_verified = false) → Backend generates verification token → Backend stores token with 24h expiry → Backend sends verification email via Resend → Backend returns success → User receives email → User clicks link → App calls /verify-email/:token → Backend validates token → Backend updates is_email_verified = true → Backend marks token used → User redirected to login

**Flow 2: Login and authenticated requests**
User enters credentials → App sends POST to /login → Backend validates credentials → Backend verifies argon2id password hash → Backend generates JWT access token (15m expiry) → Backend generates refresh token → Backend hashes refresh token (SHA-256) → Backend stores hashed token in database → Backend returns tokens → App stores access token in AsyncStorage → App stores refresh token in SecureStore → User navigates to protected screen → App includes access token in Authorization header → Backend middleware verifies JWT → Backend returns protected data

**Flow 3: Token refresh**
App makes API request → Backend returns 401 "token expired" → App intercepts 401 → App retrieves refresh token from SecureStore → App sends POST to /refresh with refresh token → Backend hashes token → Backend queries database → Backend validates not expired/revoked → Backend generates new access + refresh tokens → Backend revokes old refresh token (rotation) → Backend stores new refresh token → Backend returns new tokens → App stores new tokens → App retries original request with new access token

**Flow 4: Password reset**
User clicks "Forgot password" → App sends POST to /forgot-password with email → Backend generates reset token → Backend stores token with 1h expiry → Backend sends reset email via Resend → Backend returns success (always, even if email not found) → User receives email → User clicks link → App opens reset form → User enters new password → App sends POST to /reset-password with token + new password → Backend validates token → Backend hashes new password with argon2id → Backend updates user password → Backend marks token used → Backend revokes all refresh tokens → Backend sends confirmation email → User redirected to login

## Common misconceptions: What developers get wrong

**Misconception 1: "Expo handles authentication for me"**

Reality: Expo provides client-side authentication tools (OAuth flows, secure storage, biometrics) but zero backend services. You must build all server-side authentication—password hashing, user databases, JWT generation, session management—yourself.

**Misconception 2: "I can hash passwords on the mobile device"**

Reality: While technically possible, client-side password hashing provides no security benefit because credentials must still be transmitted to the server for validation. Argon2id is deliberately expensive and would drain mobile batteries. The server is the proper place for cryptographic operations. The key security measure is HTTPS encryption during transmission.

**Misconception 3: "JWT tokens are secure in AsyncStorage"**

Reality: AsyncStorage is unencrypted. While short-lived access tokens (15 minutes) in AsyncStorage are acceptable, refresh tokens should use expo-secure-store for hardware-backed encryption with iOS Keychain and Android Keystore.

**Misconception 4: "expo-auth-session handles everything for OAuth"**

Reality: expo-auth-session handles the client-side OAuth flow with automatic PKCE, but you must build backend endpoints to validate OAuth tokens from Google/Apple and issue your own JWTs. The mobile app receives an idToken from the provider, sends it to your backend, and your backend validates it with the provider's public keys before creating a session.

**Misconception 5: "Refresh tokens should never expire"**

Reality: Refresh tokens must have expiration dates (7-30 days for mobile). Implement refresh token rotation—when a refresh token is used, immediately issue a new one and revoke the old one. This enables detection of token theft (if a revoked token is presented, revoke all tokens for that user).

**Misconception 6: "I should reveal specific errors like 'user not found' vs 'wrong password'"**

Reality: Always return generic "invalid credentials" errors for failed logins. Revealing whether a user exists enables email enumeration attacks where attackers can discover which emails are registered in your system.

**Misconception 7: "Email verification is optional"**

Reality: Email verification prevents spam accounts, confirms users own the email address, and is critical for password recovery. Never allow users to login with is_email_verified = false.

**Misconception 8: "Free email services are unreliable"**

Reality: Resend's free tier (3,000/month permanently) is specifically designed for transactional emails with excellent deliverability. The limitation is volume, not reliability. However, avoid Nodemailer with Gmail for production—those emails consistently land in spam folders.

**Misconception 9: "I need Firebase or Supabase for authentication"**

Reality: Backend-as-a-Service platforms are optional convenience layers, not requirements. You can build production-ready authentication with completely free open-source libraries (Fastify, argon2, @fastify/jwt) and have full control over your data and logic. The trade-off is development time versus control and customization.

**Misconception 10: "Google OAuth costs money after a certain number of users"**

Reality: Google's OAuth 2.0 API is completely free with no per-user charges or API call limits. The 100-user limit applies only to unverified apps, and Google app verification is a free process (though it requires documentation and review time). Apple Sign-In requires the $99/year developer account but has no per-user costs.

## Summary: Your complete free authentication stack

**What Expo provides for free:**
- expo-auth-session: OAuth 2.0 client flows with automatic PKCE
- expo-secure-store: Hardware-backed encrypted storage for tokens
- expo-local-authentication: Biometric authentication (Face ID, Touch ID, fingerprint)
- No backend services, no JWT management, no session handling

**What you must build on the backend:**
- Password hashing with argon2id (memoryCost 19456, timeCost 2, parallelism 1)
- User database with PostgreSQL (users, email verification tokens, password reset tokens, refresh tokens)
- JWT generation and verification with @fastify/jwt (15-minute access tokens)
- Refresh token rotation with SHA-256 hashing and reuse detection
- All authentication endpoints (register, login, refresh, logout, forgot password, reset password, verify email)
- Rate limiting with @fastify/rate-limit (5 attempts per 15 minutes on login)
- Email sending via Resend (3,000/month free permanently)
- OAuth backend validation for Google (google-auth-library) and Apple (verify-apple-id-token)
- Input validation with Joi or Zod
- Audit logging for security events

**Where argon2id fits:**
- Runs exclusively on backend server (never on mobile devices)
- Hashes passwords during registration before database storage
- Verifies passwords during login by comparing hashes
- Uses argon2.hash() for registration, argon2.verify() for login
- Configuration: type argon2id, 19MB memory, 2 iterations, single-thread parallelism

**Complete free tech stack:**
- Mobile: Expo + expo-secure-store + expo-auth-session + axios
- Backend: Fastify + @fastify/jwt + argon2 + PostgreSQL + Resend
- OAuth: google-auth-library (free) + verify-apple-id-token (free, but $99/year Apple Developer required)
- Email: Resend 3,000/month free tier (never expires)
- Database: PostgreSQL with proper schemas for users, tokens, audit logs

**Total cost:** $0 for unlimited users (or $99/year if adding Apple Sign-In, required for iOS publishing anyway).

**Token strategy for mobile:**
- Access tokens: 15-minute lifespan, stored in AsyncStorage
- Refresh tokens: 7-day lifespan, stored in SecureStore, rotated on use
- Automatic refresh using axios interceptors on 401 responses

**Security essentials:**
- All communication over HTTPS in production
- Rate limiting on all authentication endpoints
- Refresh token rotation with reuse detection
- Never reveal user existence in error messages
- Hash refresh tokens before database storage
- Implement email verification before allowing login
- Log all authentication events for audit trails

This architecture provides production-ready, secure, zero-cost authentication suitable for mobile apps with thousands of users.