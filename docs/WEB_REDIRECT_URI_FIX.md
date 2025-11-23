# Fixing Web Redirect URI Mismatch (Google OAuth)

The web login flow now hard-codes `https://node-social.com` as the redirect URI (see `app/src/screens/LoginScreen.tsx`). If you hit `redirect_uri_mismatch`, make sure Google Cloud Console matches exactly.

## Steps
1) Open the web app login screen and check the browser console; it logs the redirect URI. By default it is `https://node-social.com`.
2) In Google Cloud Console → APIs & Services → Credentials → your Web Client ID → **Authorized redirect URIs**, add:
   - `https://node-social.com`
   - Optionally `http://localhost:19006` if you run Expo web locally and see that in the console.
3) Save, wait 5–10 minutes, then retry login.

Notes:
- Only HTTPS URLs are valid in the Web Client list; do not add the custom scheme (`nodesocial://…`).
- Native (iOS/Android) redirects are handled automatically by their client IDs; you do not register those here.
