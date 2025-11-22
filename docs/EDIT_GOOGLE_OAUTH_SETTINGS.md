# Editing Your Existing Google OAuth Settings

Since you've already completed the wizard, here's how to edit your current settings.

## Editing OAuth Consent Screen

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** > **OAuth consent screen**
4. You'll see your current settings. Click **EDIT APP** (top right)

### What to Check/Update:

**App Information Tab:**
- **App name**: Make sure it's set (e.g., "Node Social")
- **User support email**: Your email
- **App domain**: 
  - Homepage: `https://api.node-social.com`
  - (You can add more domains if needed)
- **Developer contact information**: Your email
- Click **SAVE AND CONTINUE**

**Scopes Tab:**
- Make sure these scopes are checked:
  - `openid` (usually there by default)
  - `https://www.googleapis.com/auth/userinfo.email`
  - `https://www.googleapis.com/auth/userinfo.profile`
- If any are missing, click **ADD OR REMOVE SCOPES** and add them
- Click **SAVE AND CONTINUE**

**Test users Tab (CRITICAL!):**
- This is the most important one for testing
- **If you get "Ineligible accounts" error:**
  - Make sure you're using a Google account (Gmail or Google Workspace)
  - The account must be fully set up (not just created)
  - Try using a different Google account if available
  - Or check if the email is already in the list (scroll down)
- Click **+ ADD USERS**
- Add your Google account email address
- Add any friends' emails who will test with you
- Click **ADD**
- Click **SAVE AND CONTINUE**

**Summary Tab:**
- Review everything
- Click **BACK TO DASHBOARD**

## Adding Redirect URI to Web Client

1. Go to **APIs & Services** > **Credentials**
2. Find your **Web application** OAuth 2.0 Client ID
   - It should end in `.apps.googleusercontent.com`
   - The one in your app.json is: `210296746860-un9cjkkutporg4hf1306mjv46ora003b.apps.googleusercontent.com`
3. Click the **pencil icon** (Edit) next to it
4. Scroll down to **Authorized redirect URIs**
5. Click **+ ADD URI**
6. Add: `https://api.node-social.com/auth/google/callback`
7. Click **SAVE**

**Note**: For native mobile apps (iOS/Android), you don't need redirect URIs - they work automatically. Only add this if you're building a web version.

## Quick Checklist

- [ ] OAuth consent screen > Test users: Your email is added
- [ ] OAuth consent screen > Scopes: openid, email, profile are checked
- [ ] OAuth consent screen > App domain: `https://api.node-social.com` is set
- [ ] Credentials > Web Client: Redirect URI added (optional for native apps)
- [ ] Wait 5-10 minutes after changes

## Most Common Issue

**"This app isn't verified" or "App is in testing" error:**
- Go to **OAuth consent screen** > **Test users** tab
- Make sure your email is in the list
- If it's not there, click **+ ADD USERS** and add it
- Save and wait a few minutes

That's it! The main thing is making sure your email is in the Test users list if your app is in Testing mode.

