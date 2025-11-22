# Android Google OAuth Redirect Fix

## Issues Fixed

### 1. **Missing Redirect URI Configuration**
**Problem**: The `useIdTokenAuthRequest` hook wasn't explicitly setting a `redirectUri`, which is critical for Android to properly handle the OAuth callback.

**Fix**: Added explicit `redirectUri` configuration:
```typescript
const redirectUri = AuthSession.makeRedirectUri({
  scheme: "nodesocial",
  path: "oauth2redirect/google",
});
```

### 2. **Incorrect Client ID Selection**
**Problem**: The client ID fallback chain wasn't prioritizing platform-specific IDs correctly. On Android, it should use `androidClientId` first.

**Fix**: Changed to platform-specific selection:
```typescript
clientId:
  Platform.OS === "android"
    ? googleOAuthConfig.androidClientId ?? googleOAuthConfig.expoClientId ?? ""
    : Platform.OS === "ios"
    ? googleOAuthConfig.iosClientId ?? googleOAuthConfig.expoClientId ?? ""
    : googleOAuthConfig.webClientId ?? googleOAuthConfig.expoClientId ?? "",
```

### 3. **Missing Response Token Location Handling**
**Problem**: The code only checked `params.id_token`, but on Android the token might be in different locations in the response.

**Fix**: Added multiple fallback checks:
```typescript
const token =
  params?.id_token ||
  params?.idToken ||
  params?.token ||
  (googleResponse as any).authentication?.idToken;
```

### 4. **Missing Debug Logging**
**Problem**: No visibility into what was actually happening during the OAuth flow.

**Fix**: Added comprehensive console logging to help diagnose issues.

## Additional Checks Needed

### 1. **Google Cloud Console - Authorized Redirect URIs**

For **Android OAuth Client ID**, ensure these redirect URIs are added:

**For Development (Expo Go):**
- `https://auth.expo.io/@<your-expo-username>/app`
- Or check the actual redirect URI by logging `redirectUri` in the app

**For Production (Standalone Build):**
- `nodesocial:/oauth2redirect/google`
- `com.nodesocial.app:/oauth2redirect/google`

**To find your exact redirect URI:**
1. Add this temporarily to LoginScreen.tsx:
   ```typescript
   console.log("Redirect URI:", redirectUri);
   ```
2. Check the console output when the app starts
3. Add that exact URI to Google Cloud Console

### 2. **Android Package Name & SHA-1**

Verify in Google Cloud Console:
- **Package name**: `com.nodesocial.app` (matches `app.json`)
- **SHA-1 certificate fingerprint**: Run `expo fetch:android:hashes` and add all hashes to Google Cloud Console

### 3. **App.json Configuration**

Your `app.json` already has:
- ✅ `scheme: "nodesocial"` - Good!
- ✅ `android.package: "com.nodesocial.app"` - Good!
- ✅ `googleAndroidClientId` in extra.eas - Good!

### 4. **Testing**

**In Development (Expo Go):**
- The proxy will be used (`useProxy: true`)
- Redirect URI will be the Expo auth proxy URL
- Make sure this is added to Google Cloud Console

**In Production Build:**
- Native redirect will be used (`useProxy: false`)
- Redirect URI will be `nodesocial:/oauth2redirect/google`
- Make sure this is added to Google Cloud Console

## Debugging Steps

1. **Check Console Logs**: The app now logs:
   - Redirect URI being used
   - Full Google OAuth response
   - Token location if found
   - Any errors

2. **Verify Redirect URI**: Check the console for the actual redirect URI and ensure it matches Google Cloud Console

3. **Check Response Structure**: If token is still missing, check the console logs to see the full response structure

4. **Test in Standalone Build**: Some issues only appear in production builds:
   ```bash
   eas build -p android --profile preview
   ```

## Common Issues

### Issue: "Redirect URI mismatch"
**Solution**: Ensure the exact redirect URI from console logs is in Google Cloud Console

### Issue: "id_token not found"
**Solution**: Check console logs to see the actual response structure, then update the token extraction logic

### Issue: "App doesn't redirect back"
**Solution**: 
- Verify SHA-1 fingerprint is correct
- Ensure package name matches exactly
- Check that deep linking is working: `adb shell am start -W -a android.intent.action.VIEW -d "nodesocial://test" com.nodesocial.app`

## Next Steps

1. Test the app and check console logs
2. Verify the redirect URI matches Google Cloud Console
3. If still not working, share the console logs for further debugging

