# OAuth Account Linking Analysis

## Current State

### Does this project have OIDC?
**No, not full OIDC.** The project uses:
- **Google**: Direct ID token verification using `google-auth-library` (not full OIDC flow)
- **Apple**: JWT verification using `jose` library (not full OIDC flow)

This is actually fine for mobile apps - you don't need full OIDC. The current approach is simpler and works well.

### Is account linking necessary?
**Yes, absolutely!** Users should be able to:
1. Sign up with email/password
2. Later sign in with Google/Apple using the same email
3. Have all methods work for the same account

## The Problem

### Current Account Linking Logic (in `auth.ts`)

**Google Sign-In Flow (lines 209-254):**
```typescript
// 1. Try to find user by googleId first
let user = await findUnique({ where: { googleId } }) 
  || await findUnique({ where: { email } });

// 2. If found by email but no googleId, try to link
if (!user.googleId) {
  updates = { googleId }; // ⚠️ PROBLEM HERE
}
```

**The Issue:**
The code has a **critical flaw** in account linking:

1. **Scenario A - Works**: User signs up with email, then signs in with Google (same email)
   - Finds user by email ✅
   - Links googleId ✅
   - Works!

2. **Scenario B - Fails**: User signs up with Google first, then tries email/password
   - User exists with googleId ✅
   - But if they try email/password login, it won't link the password to the OAuth account
   - They'd need to use Google every time

3. **Scenario C - Fails**: Two different Google accounts with same email (rare but possible)
   - User A: email="user@example.com", googleId="google123"
   - User B: email="user@example.com", googleId="google456" 
   - This would violate the unique email constraint

4. **Scenario D - Fails**: googleId already exists on different user
   - User A: email="user@example.com", googleId=null
   - User B: email="other@example.com", googleId="google123"
   - User A tries to sign in with Google (googleId="google123")
   - Code finds User A by email
   - Tries to set googleId="google123" on User A
   - **UNIQUE CONSTRAINT VIOLATION** - googleId already exists on User B!

### The Real Problem

The account linking logic doesn't check if the `googleId` or `appleId` is already taken by another user before trying to link it. This causes database constraint violations.

## The Fix

The account linking needs to:
1. Check if the provider ID (googleId/appleId) already exists on a different user
2. If it does, either:
   - Merge the accounts (complex)
   - Return an error asking user to use the original sign-in method
   - Or handle it gracefully

Here's what needs to be fixed:

### For Google Sign-In:
```typescript
// After finding user by email, before linking:
if (!user.googleId) {
  // Check if this googleId is already taken by another user
  const existingUserWithGoogleId = await fastify.prisma.user.findUnique({
    where: { googleId }
  });
  
  if (existingUserWithGoogleId && existingUserWithGoogleId.id !== user.id) {
    // Conflict! This googleId belongs to another account
    return reply.status(409).send({ 
      error: 'This Google account is already linked to a different account. Please sign in with your original method.' 
    });
  }
  
  // Safe to link
  updates = { ...(updates ?? {}), googleId };
}
```

### Same fix needed for Apple Sign-In (lines 324-377)

## Why It's Not Working For You

Based on your description:
- You signed up with email/password
- You're trying to sign in with Google/Apple
- It's not linking properly

**Most likely causes:**
1. The `googleId`/`appleId` you're trying to link is already taken by another user account
2. The database constraint is preventing the link
3. The error is being swallowed and you're getting a generic "sign-in failed" message

## Recommended Solution

1. ✅ **Fix the account linking logic** to check for conflicts before linking
2. ✅ **Add better error handling** to surface specific errors
3. ⚠️ **Consider account merging** if the same email exists with different provider IDs (not implemented - would require more complex logic)
4. ✅ **Add logging** to track when linking fails and why

## Fixes Implemented

I've fixed the account linking logic in `backend/api/src/routes/auth.ts`:

### Changes Made:

1. **Google Sign-In (lines 231-280)**:
   - Added check to see if `googleId` is already taken by another user before linking
   - Returns 409 Conflict with clear error message if conflict detected
   - Added try-catch around database update to handle unique constraint violations
   - Improved error logging with context

2. **Apple Sign-In (lines 354-403)**:
   - Same fixes as Google Sign-In
   - Checks for `appleId` conflicts before linking
   - Better error handling and logging

3. **Error Handling Improvements**:
   - Catches Prisma unique constraint violations (P2002) specifically
   - Returns 409 Conflict status with helpful error messages
   - Preserves existing error responses for other error types
   - Enhanced logging with error codes and context

### What This Fixes:

- ✅ Prevents database constraint violations when linking accounts
- ✅ Provides clear error messages when conflicts occur
- ✅ Logs conflicts for debugging
- ✅ Handles edge cases where provider IDs are already taken

### Testing:

To test if this fixes your issue:
1. Try signing in with Google/Apple using an email you've already registered
2. If there's a conflict, you'll now get a clear error message instead of a generic failure
3. Check server logs for detailed conflict information

