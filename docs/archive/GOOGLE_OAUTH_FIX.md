# Fixing Google OAuth "Error 400: invalid_request"

This error occurs when your app's redirect URI doesn't match what's registered in Google Cloud Console, or when the OAuth consent screen isn't properly configured.

## 🚨 Quick Fix for Native Mobile Apps

**If you're seeing "Invalid Redirect: must end with a public top-level domain" when trying to add `nodesocial://oauth2redirect/google`:**

**STOP!** You don't need to add that URI. For native mobile apps:

1. **Go to OAuth consent screen** (not Credentials)
2. **Complete all configuration steps** (app name, email, scopes)
3. **Add your email to Test users** (if app is in Testing mode)
4. **Save and wait 5-10 minutes**
5. **Try signing in again**

**The Web Client's "Authorized redirect URIs" field only accepts HTTPS URLs** - it cannot accept custom URL schemes like `nodesocial://`. For native apps, redirect URIs are handled automatically by your platform-specific client IDs (Android/iOS).

## ⚠️ IMPORTANT: Native Apps vs Web Apps

**For native mobile apps (iOS/Android):**
- **DO NOT** register custom URL schemes (like `nodesocial://`) in the Web Client's "Authorized redirect URIs"
- That field **only accepts HTTPS URLs** (like `https://example.com/callback`)
- Native apps use platform-specific client IDs that handle redirect URIs automatically
- iOS uses reverse client ID format: `com.googleusercontent.apps.CLIENT_ID:/`
- Android uses package name automatically

**For web apps:**
- You **DO** need to register HTTPS redirect URIs in the Web Client

## Step 1: Configure OAuth Consent Screen (REQUIRED)

This is the most common cause of "Error 400: invalid_request" for native apps.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **OAuth consent screen**
4. Configure the consent screen:
   - **User Type**: Choose "External" (unless you have a Google Workspace)
   - **App name**: Your app name (e.g., "Node Social")
   - **User support email**: Your email
   - **Developer contact information**: Your email
5. Under **Scopes**, click **ADD OR REMOVE SCOPES** and ensure these are added:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
6. **CRITICAL**: Under **Test users** (if app is in Testing mode):
   - Click **+ ADD USERS**
   - Add your Google account email address
   - **Important**: If your app is in "Testing" mode, only test users can sign in
7. Click **SAVE AND CONTINUE** through all steps
8. If you see "Publishing status: Testing", you must add test users or publish the app

## Step 2: Verify Platform Client IDs

For native apps, you need separate client IDs for each platform:

1. Go to **APIs & Services** > **Credentials**
2. Verify you have:
   - **Android OAuth 2.0 Client ID** - with your package name (`com.nodesocial.app`)
   - **iOS OAuth 2.0 Client ID** - with your bundle ID (`com.nodesocial.app`)
   - **Web application OAuth 2.0 Client ID** - used for backend token verification

### For Android Client ID:
- Package name must match exactly: `com.nodesocial.app` (all lowercase)
- SHA-1 certificate fingerprint must be registered
- For development: Add your debug keystore SHA-1
- For production: Add your release keystore SHA-1

### For iOS Client ID:
- Bundle ID must match exactly: `com.nodesocial.app`
- The redirect URI is automatically handled as: `com.googleusercontent.apps.YOUR_CLIENT_ID:/`

## Step 3: Web Client Configuration (For Web Apps Only)

**Only do this if you're building a web app:**

1. Go to **APIs & Services** > **Credentials**
2. Find your **Web Client ID**
3. Click **Edit** (pencil icon)
4. Under **Authorized redirect URIs**, add HTTPS URLs only:
   - Example: `https://yourdomain.com/auth/callback`
   - Example: `https://localhost:19006` (for local development)
   - **DO NOT** add custom URL schemes like `nodesocial://`

### B. Verify OAuth Consent Screen

1. Navigate to **APIs & Services** > **OAuth consent screen**
2. Ensure the consent screen is configured:
   - **User Type**: Choose "External" (unless you have a Google Workspace)
   - **App name**: Your app name (e.g., "Node Social")
   - **User support email**: Your email
   - **Developer contact information**: Your email
3. Under **Scopes**, ensure these are added:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
4. Under **Test users** (if app is in Testing mode):
   - Add your Google account email address
   - **Important**: If your app is in "Testing" mode, only test users can sign in
5. Click **SAVE AND CONTINUE** through all steps

### C. Verify Client IDs Match

Ensure your client IDs in `app.json` match what's in Google Cloud Console:

- **Android Client ID**: Should be an Android OAuth 2.0 Client ID
- **iOS Client ID**: Should be an iOS OAuth 2.0 Client ID  
- **Web Client ID**: Should be a Web application OAuth 2.0 Client ID

## Step 4: Common Issues and Solutions

### Issue: "App is in Testing Mode" / "This app isn't verified"

**Solution**: 
- Go to **OAuth consent screen** > **Test users**
- Click **+ ADD USERS**
- Add your Google account email address
- Save and wait a few minutes
- Try signing in again

**Alternative**: Publish your app (requires verification for production)

### Issue: "Invalid Redirect: must end with a public top-level domain"

**This error means you're trying to add a custom URL scheme to the Web Client's redirect URIs.**

**Solution for Native Apps**:
- **DO NOT** add `nodesocial://` or any custom URL schemes to Web Client redirect URIs
- That field only accepts HTTPS URLs
- For native apps, redirect URIs are handled automatically by platform client IDs
- Focus on configuring the OAuth consent screen and adding test users instead

### Issue: "Error 400: invalid_request"

**Most common causes for native apps**:
1. **OAuth consent screen not configured** - Go to OAuth consent screen and complete all steps
2. **App in Testing mode without test users** - Add your email to test users
3. **Missing scopes** - Ensure `openid`, `email`, and `profile` scopes are added
4. **Wrong client IDs** - Verify Android/iOS client IDs match your app configuration

**Solutions**:
1. Complete OAuth consent screen configuration
2. Add your email to test users (if in Testing mode)
3. Wait 5-10 minutes for changes to propagate
4. Clear app cache or reinstall the app
5. Verify platform client IDs are correctly configured

### Issue: "redirect_uri_mismatch" Error

**For Native Apps**: This usually means the OAuth consent screen isn't properly configured or test users aren't added.

**For Web Apps**: The redirect URI in your code doesn't match Google Cloud Console exactly.

**Solution for Web Apps**:
1. Log the exact redirect URI from your app
2. Copy it exactly (including all slashes and paths)
3. Add it to Google Cloud Console Web Client's "Authorized redirect URIs" (HTTPS only)
4. Save and wait 5-10 minutes

## Step 5: Verify Configuration

After making changes:

1. **Wait 5-10 minutes** for Google's changes to propagate
2. **Clear your app's cache** or reinstall the app
3. **Try signing in again**
4. Check the console logs for any error messages

## Platform-Specific Notes

### Android (Native App)
- **DO NOT** register redirect URIs in Web Client for native Android apps
- Android package name must be lowercase: `com.nodesocial.app` (not `com.NodeSocial.App`)
- SHA-1 fingerprint must be registered for Android Client ID
- Redirect URI is automatically handled based on package name

### iOS (Native App)
- **DO NOT** register redirect URIs in Web Client for native iOS apps
- Bundle ID must match: `com.nodesocial.app`
- Redirect URI is automatically handled as: `com.googleusercontent.apps.YOUR_IOS_CLIENT_ID:/`
- URL scheme must be registered in `Info.plist` (handled by Expo)

### Web App
- **DO** register HTTPS redirect URIs in Web Client's "Authorized redirect URIs"
- Example: `https://yourdomain.com/auth/callback`
- Example: `https://localhost:19006` (for local development)

## Quick Checklist for Native Apps

- [ ] OAuth consent screen fully configured (all steps completed)
- [ ] App name, email, and developer contact info added
- [ ] Required scopes added (openid, email, profile)
- [ ] Test user added (if app is in Testing mode)
- [ ] Android Client ID configured with correct package name and SHA-1
- [ ] iOS Client ID configured with correct bundle ID
- [ ] Web Client ID configured (for backend token verification)
- [ ] Waited 5-10 minutes after making changes
- [ ] App cache cleared / app reinstalled
- [ ] **NOT** trying to add custom URL schemes to Web Client redirect URIs

## Quick Checklist for Web Apps

- [ ] HTTPS redirect URI added to Web Client's "Authorized redirect URIs"
- [ ] OAuth consent screen configured with app name and email
- [ ] Required scopes added (openid, email, profile)
- [ ] Test user added (if app is in Testing mode)
- [ ] Waited 5-10 minutes after making changes
- [ ] Exact redirect URI matches (no trailing slashes, correct case)

## Still Having Issues?

1. Check the exact redirect URI in your app's console logs
2. Verify it's added to Google Cloud Console Web Client (not just Android/iOS clients)
3. Ensure OAuth consent screen is fully configured
4. If in Testing mode, add your email to test users
5. Wait 10 minutes and try again

The redirect URI format should be: `nodesocial://oauth2redirect/google` (or similar based on your scheme and path configuration).

