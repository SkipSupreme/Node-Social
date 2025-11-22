# Quick Domain Setup for node-social.com

## TL;DR - Get HTTPS API Running in 5 Minutes

```bash
# 1. Install Cloudflare Tunnel
brew install cloudflare/cloudflare/cloudflared

# 2. Run the setup script
./setup-domain.sh

# 3. Start your backend
cd backend/api && npm run dev

# 4. In another terminal, start the tunnel
cloudflared tunnel run node-social-dev

# 5. Your API is now at https://api.node-social.com 🎉
```

## What This Does

- ✅ Sets up Cloudflare Tunnel (free HTTPS, no port forwarding needed)
- ✅ Creates `api.node-social.com` subdomain pointing to your dev server
- ✅ Automatic HTTPS (no cert setup needed)
- ✅ Works from anywhere (your friends can test it)

## Update Your App Config

Once the tunnel is running, update your app to use the domain:

### Option 1: Environment Variable (Recommended)

Create `app/.env`:
```bash
EXPO_PUBLIC_API_URL=https://api.node-social.com
```

### Option 2: Update app.json

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://api.node-social.com"
    }
  }
}
```

Then update `app/src/config.ts` to use it:
```typescript
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  `http://${LOCAL_DEV_IP}:3000`;
```

## Update Google OAuth

Now you can add proper redirect URIs in Google Cloud Console:

1. Go to Google Cloud Console > APIs & Services > Credentials
2. Edit your **Web Client ID**
3. Add to **Authorized redirect URIs**:
   - `https://api.node-social.com/auth/google/callback` (if you add a web callback)
   - `https://node-social.com/auth/callback` (for web app)

For native mobile apps, you still don't need to add redirect URIs - they work automatically.

## Keep Tunnel Running

The tunnel needs to stay running. Options:

**Option 1: Background process**
```bash
cloudflared tunnel run node-social-dev &
```

**Option 2: Separate terminal**
Just keep a terminal open with the tunnel running.

**Option 3: Process manager (pm2)**
```bash
npm install -g pm2
pm2 start cloudflared --name tunnel -- tunnel run node-social-dev
pm2 save
pm2 startup  # Auto-start on boot
```

## Testing

1. Start backend: `cd backend/api && npm run dev`
2. Start tunnel: `cloudflared tunnel run node-social-dev`
3. Test API: `curl https://api.node-social.com/health`
4. Should return: `{"ok":true}`

## Troubleshooting

- **"Tunnel not found"**: Run `./setup-domain.sh` again
- **"DNS not resolving"**: Wait 2-3 minutes for DNS propagation
- **"Connection refused"**: Make sure your backend is running on port 3000
- **CORS errors**: Backend CORS is set to allow all origins - should work fine

## Next Steps

- Test Google OAuth with the real domain
- Share `https://api.node-social.com` with friends for testing
- Consider setting up the web app at `node-social.com` later

