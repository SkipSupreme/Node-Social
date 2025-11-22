# Fixing Web Redirect URI Mismatch Error

If you're getting "Error 400: redirect_uri_mismatch" on web, follow these steps:

## Step 1: Find Your Exact Redirect URI

1. Open your web app in the browser
2. Open the browser console (F12 or Cmd+Option+I)
3. Look for the log message that says:
   ```
   🔴 WEB REDIRECT URI - COPY THIS EXACTLY:
   ═══════════════════════════════════════
   http://localhost:19006
   ═══════════════════════════════════════
   ```
4. **Copy that exact URI** (it might be `http://localhost:19006` or similar)

## Step 2: Add to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** > **Credentials**
4. Find your **Web application** OAuth 2.0 Client ID
   - It should end in `.apps.googleusercontent.com`
   - The one in your app.json: `210296746860-un9cjkkutporg4hf1306mjv46ora003b.apps.googleusercontent.com`
5. Click the **pencil icon** (Edit)
6. Scroll down to **Authorized redirect URIs**
7. Click **+ ADD URI**
8. **Paste the exact URI** from Step 1
   - Example: `http://localhost:19006`
   - **Important**: Must match exactly - including `http://` or `https://`, port number, no trailing slash
9. Click **SAVE**

## Step 3: Wait and Test

- Wait **5-10 minutes** for Google's changes to propagate
- Refresh your web app
- Try Google sign-in again

## Common Redirect URIs

Depending on where your app is running:

- **Local development**: `http://localhost:19006` (or whatever port Expo uses)
- **Expo web**: `http://localhost:19006` or `https://localhost:19006`
- **Production domain**: `https://node-social.com` or `https://yourdomain.com`

## Important Notes

- The URI must match **exactly** - including:
  - Protocol (`http://` vs `https://`)
  - Port number (`:19006`)
  - No trailing slash (unless your app uses one)
  - Case sensitivity

- You can add **multiple redirect URIs** if you're testing in different environments:
  - `http://localhost:19006` (local dev)
  - `https://node-social.com` (production)

## Still Not Working?

1. **Check the console** - the exact URI is logged there
2. **Verify it's added** - go back to Google Cloud Console and check the list
3. **Wait longer** - sometimes takes 10-15 minutes
4. **Clear browser cache** - try incognito/private mode
5. **Check for typos** - must match exactly, character for character

## Quick Checklist

- [ ] Found the redirect URI in browser console
- [ ] Copied it exactly (including http:// and port)
- [ ] Added to Web Client's "Authorized redirect URIs"
- [ ] Clicked SAVE
- [ ] Waited 5-10 minutes
- [ ] Tried again

The redirect URI is logged in the console when you load the login page - just copy it from there!

