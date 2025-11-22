# Apple Sign-In Security Checks & Re-authentication

## What You're Asking About

Apple performs **random security checks** and can revoke credentials at any time. This requires:

1. **Credential State Checks** - Verify credentials are still valid
2. **Re-authentication** - Prompt user to sign in again if revoked
3. **Periodic Validation** - Check credential state on app launch/periodically

## Current Status: ✅ **NOW IMPLEMENTED**

We've added Apple credential state checking! The system now:
- ✅ Checks credential state on app launch
- ✅ Automatically logs out if credentials are revoked
- ✅ Stores Apple user ID for state checks
- ✅ Handles simulator limitations gracefully

## What We Need to Add

### 1. `getCredentialStateAsync()` - Check Credential Validity

Apple provides this method to check if a user's Apple Sign-In credentials are still valid:

```typescript
import * as AppleAuthentication from 'expo-apple-authentication';

// Check if credentials are still valid
const credentialState = await AppleAuthentication.getCredentialStateAsync(userId);
```

**Possible States:**
- `AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED` - ✅ Valid
- `AppleAuthentication.AppleAuthenticationCredentialState.REVOKED` - ❌ Revoked
- `AppleAuthentication.AppleAuthenticationCredentialState.NOT_FOUND` - ❌ Never existed
- `AppleAuthentication.AppleAuthenticationCredentialState.TRANSFERRED` - ⚠️ Transferred to another device

### 2. When to Check

- **On app launch** - Verify existing sessions
- **Before sensitive operations** - Before posting, changing settings
- **Periodically** - Every 24 hours or so
- **After errors** - If API calls fail with auth errors

### 3. What to Do When Revoked

- **Log user out** - Clear session
- **Prompt re-authentication** - Ask user to sign in again
- **Show helpful message** - Explain why they need to re-authenticate

## ✅ Implementation Complete

### What We Added:

1. **`app/src/lib/appleAuth.ts`** - Credential state checking utility
   - `checkAppleCredentialState()` - Checks if credentials are valid
   - Handles simulator limitations
   - Returns clear state information

2. **Updated `app/src/store/auth.ts`** - Integrated credential checks
   - Stores Apple user ID when user signs in
   - Checks credential state on app launch
   - Automatically logs out if revoked
   - `checkAppleCredentials()` method for manual checks

3. **Updated `app/src/screens/LoginScreen.tsx`** - Stores Apple user ID
   - Captures `credential.user` on sign-in
   - Passes to auth store for state checking

### How It Works:

1. **On Sign-In**: Apple user ID (`credential.user`) is stored
2. **On App Launch**: Credential state is checked automatically
3. **If Revoked**: User is logged out automatically
4. **Manual Check**: Can call `checkAppleCredentials()` before sensitive operations

## Important Notes

⚠️ **`getCredentialStateAsync()` requires real device testing** - It throws errors on simulators.

⚠️ **Apple can revoke credentials at any time** - For security, fraud detection, or policy violations.

⚠️ **This is different from token expiration** - Token expiration is handled by refresh tokens. Credential revocation is Apple saying "this user can't use Apple Sign-In anymore."

