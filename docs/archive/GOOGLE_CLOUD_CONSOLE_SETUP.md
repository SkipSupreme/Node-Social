# Adding node-social.com to Google Cloud Console

This guide walks you through configuring Google OAuth with your real domain.

## Step 1: Open Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the one with your OAuth credentials)
3. If you don't have a project, create one first

## Step 2: Configure OAuth Consent Screen (IMPORTANT - Do This First!)

This is the most common cause of OAuth errors.

1. In the left sidebar, go to **APIs & Services** > **OAuth consent screen**
2. If you haven't set this up yet, you'll see a setup wizard. Complete all steps:

   **Step 1: User Type**
   - Select **External** (unless you have a Google Workspace)
   - Click **CREATE**

   **Step 2: App Information**
   - **App name**: `Node Social` (or whatever you want)
   - **User support email**: Your email address
   - **App logo**: (Optional - skip for now)
   - **App domain**: 
     - Homepage: `https://api.node-social.com`
     - (You can add more later)
   - **Developer contact information**: Your email address
   - Click **SAVE AND CONTINUE**

   **Step 3: Scopes**
   - Click **ADD OR REMOVE SCOPES**
   - Check these scopes:
     - `openid` (should be there by default)
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
   - Click **UPDATE**
   - Click **SAVE AND CONTINUE**

   **Step 4: Test users** (CRITICAL if app is in Testing mode)
   - Click **+ ADD USERS**
   - Add your Google account email address
   - Add any friends' emails who will test with you
   - Click **ADD**
   - Click **SAVE AND CONTINUE**

   **Step 5: Summary**
   - Review everything
   - Click **BACK TO DASHBOARD**

3. **Important**: If your app is in "Testing" mode, only the test users you added can sign in. Make sure your email is in the list!

## Step 3: Add Redirect URI to Web Client

1. In the left sidebar, go to **APIs & Services** > **Credentials**
2. Find your **Web application** OAuth 2.0 Client ID (it should end in `.apps.googleusercontent.com`)
3. Click the **pencil icon** (Edit) next to it
4. Scroll down to **Authorized redirect URIs**
5. Click **+ ADD URI**
6. Add this URI:
   ```
   https://api.node-social.com/auth/google/callback
   ```
   **Note**: This is for web apps. For native mobile apps, you don't need to add redirect URIs - they're handled automatically by platform client IDs.

7. Click **SAVE**

## Step 4: Verify Your Client IDs

Make sure you have all three client IDs configured:

1. **Android OAuth 2.0 Client ID**
   - Should have your package name: `com.nodesocial.app`
   - Should have SHA-1 fingerprint registered

2. **iOS OAuth 2.0 Client ID**
   - Should have your bundle ID: `com.nodesocial.app`

3. **Web application OAuth 2.0 Client ID**
   - Should have the redirect URI you just added
   - This is used for backend token verification

## Step 5: Wait for Changes to Propagate

- Google changes can take **5-10 minutes** to propagate
- After making changes, wait a bit before testing

## Step 6: Test It!

1. Make sure your backend is running: `cd backend/api && npm run dev`
2. Make sure your tunnel is running: `cloudflared tunnel run node-social-dev`
3. Update your app config (create `app/.env`):
   ```bash
   EXPO_PUBLIC_API_URL=https://api.node-social.com
   ```
4. Restart your app and try Google sign-in
5. It should work now! 🎉

## Troubleshooting

### "This app isn't verified" / "App is in testing"
- Go back to **OAuth consent screen** > **Test users**
- Make sure your email is added to the test users list
- Only test users can sign in when app is in Testing mode

### "Error 400: invalid_request"
- Make sure OAuth consent screen is fully configured (all 5 steps completed)
- Make sure test users are added (if in Testing mode)
- Wait 5-10 minutes after making changes

### "redirect_uri_mismatch"
- For native apps: You don't need to add redirect URIs - they're automatic
- For web apps: Make sure the redirect URI matches exactly (including https://)

## Quick Checklist

- [ ] OAuth consent screen configured (all 5 steps)
- [ ] App name and email added
- [ ] Required scopes added (openid, email, profile)
- [ ] Test users added (if in Testing mode)
- [ ] Redirect URI added to Web Client (for web apps)
- [ ] Waited 5-10 minutes after changes
- [ ] Backend running on port 3000
- [ ] Tunnel running
- [ ] App config updated with `https://api.node-social.com`

## Notes

- **Native mobile apps** (iOS/Android) don't need redirect URIs in Web Client - they're handled automatically
- **Web apps** need the redirect URI registered
- The redirect URI format must match exactly (https://, no trailing slash unless needed)
- Test users are required if your app is in Testing mode

