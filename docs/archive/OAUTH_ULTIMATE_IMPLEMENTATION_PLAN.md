# 🚀 ULTIMATE OAuth/OIDC Implementation Plan
## Based on googleapplelogin.md - Production-Ready Implementation

## Critical Requirements from Document

### 1. **Development Builds MANDATORY** ✅
- NOT using Expo Go (already confirmed)
- Using `expo-dev-client` with custom scheme
- Native builds required for OAuth

### 2. **Three-Client Strategy for Google** ⚠️
- **Android Client ID**: Requires Package Name + SHA-1 fingerprints (debug AND release)
- **iOS Client ID**: Requires Bundle ID
- **Web Client ID**: Used for backend token validation + redirect allow-list

### 3. **Redirect URI Configuration** ⚠️
- Must use `makeRedirectUri()` with explicit scheme and path
- Format: `nodesocial://oauth2redirect/google` (NOT `nodesocial:///`)
- Must match EXACTLY in Google Cloud Console
- Android package name MUST be lowercase (already is: `com.nodesocial.app` ✅)

### 4. **Apple Sign-In Requirements** ⚠️
- First login ONLY returns email/fullName - MUST cache immediately
- Subsequent logins only return identityToken + user ID
- Requires proper entitlements in provisioning profile
- Error 1000 = missing entitlement in signed binary

### 5. **Backend Token Validation** ✅
- Google: Using `google-auth-library` ✅
- Apple: Using `jose` library ✅
- Both verify signatures, audience, expiration ✅

### 6. **Token Storage** ⚠️
- MUST use `expo-secure-store` (not AsyncStorage)
- Currently using zustand store - need to verify secure storage

### 7. **PKCE Flow** ✅
- `expo-auth-session` uses PKCE by default ✅
- But we're using `useIdTokenAuthRequest` - should verify if this uses PKCE

## Implementation Steps

### Phase 1: Configuration Files ✅/⚠️

#### app.json Updates Needed:
1. ✅ Scheme is set: `"scheme": "nodesocial"`
2. ✅ Package is lowercase: `"com.nodesocial.app"`
3. ⚠️ **MISSING**: Android intent filters for deep linking
4. ✅ Apple Sign-In enabled: `"usesAppleSignIn": true`
5. ⚠️ **MISSING**: Explicit redirect URI path configuration

#### Required Changes:
```json
{
  "android": {
    "package": "com.nodesocial.app",
    "intentFilters": [
      {
        "action": "VIEW",
        "data": [
          {
            "scheme": "nodesocial"
          }
        ],
        "category": ["BROWSABLE", "DEFAULT"]
      }
    ]
  }
}
```

### Phase 2: Frontend OAuth Implementation ⚠️

#### Current Issues:
1. Using `useIdTokenAuthRequest` - document recommends `useAuthRequest` for better control
2. Redirect URI path might not match Google Cloud Console
3. Need to verify token extraction handles all response formats
4. Apple Sign-In needs first-login data caching

#### Required Changes:
1. **Switch to `useAuthRequest`** (more control, better PKCE handling)
2. **Explicit redirect URI** with path: `nodesocial://oauth2redirect/google`
3. **Better response handling** for different token locations
4. **Apple first-login caching** - store email/name immediately

### Phase 3: Backend Verification ✅/⚠️

#### Current Status:
- ✅ Google verification using `google-auth-library`
- ✅ Apple verification using `jose`
- ✅ Account linking logic with conflict detection
- ⚠️ Need to verify audience matching for all client IDs

#### Required Checks:
1. Verify Google audience includes all three client IDs
2. Verify Apple audience matches bundle ID exactly
3. Ensure proper error messages for debugging

### Phase 4: Token Storage ⚠️

#### Current Status:
- Using zustand store - need to verify if it uses secure storage
- Should migrate to `expo-secure-store` for tokens

### Phase 5: Testing Checklist

#### Pre-Deployment:
- [ ] Deep linking works: `npx uri-scheme open nodesocial://test`
- [ ] Redirect URI logged and matches Google Cloud Console
- [ ] Android SHA-1 fingerprints registered (debug + release)
- [ ] iOS bundle ID matches Apple Developer Portal
- [ ] Apple Sign-In entitlement in provisioning profile
- [ ] Test on real devices (not just simulators)
- [ ] First-login data cached properly
- [ ] Account linking works (email/password → OAuth)

## Priority Fixes (In Order)

1. **Add Android intent filters** to app.json
2. **Switch Google OAuth to useAuthRequest** with explicit redirect
3. **Fix redirect URI** to match document format
4. **Add Apple first-login caching**
5. **Verify token storage** uses secure-store
6. **Test deep linking** works properly

