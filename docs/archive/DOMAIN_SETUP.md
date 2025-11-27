# Setting Up node-social.com Domain for Development

This guide will help you set up your domain with Cloudflare and expose your dev server with HTTPS.

## Option 1: Cloudflare Tunnel (Recommended - Easiest)

Cloudflare Tunnel (cloudflared) is perfect for dev servers - it's free, gives you HTTPS automatically, and doesn't require port forwarding.

### Step 1: Install Cloudflare Tunnel

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Or download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

### Step 2: Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This will open a browser window. Log in with your Cloudflare account and select the domain `node-social.com`.

### Step 3: Create a Tunnel

```bash
cloudflared tunnel create node-social-dev
```

This creates a tunnel and gives you a tunnel ID. Save this ID.

### Step 4: Configure the Tunnel

Create a config file at `~/.cloudflared/config.yml`:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /Users/joshhd/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # Route API traffic to your backend
  - hostname: api.node-social.com
    service: http://localhost:3000
  
  # Route web app traffic (if you build web version)
  - hostname: node-social.com
    service: http://localhost:8081
  
  # Catch-all (must be last)
  - service: http_status:404
```

### Step 5: Route DNS

You can route DNS via CLI or manually in Cloudflare dashboard:

**Option A: Via CLI (if it works):**
```bash
cloudflared tunnel route dns node-social-dev api.node-social.com
cloudflared tunnel route dns node-social-dev node-social.com
```

**Option B: Via Cloudflare Dashboard (if CLI fails):**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) > Select `node-social.com` domain
2. Go to **Zero Trust** > **Networks** > **Tunnels**
3. Click on your `node-social-dev` tunnel
4. Go to **Public Hostnames** tab
5. Add two hostname routes:
   - **Public hostname**: `api.node-social.com` → **Service**: `http://localhost:3000`
   - **Public hostname**: `node-social.com` → **Service**: `http://localhost:19006`

OR you can set up CNAME records manually:
1. Go to **DNS** > **Records**
2. For `api.node-social.com`: Add CNAME record pointing to `7334cd6f-3105-4159-90eb-0a10658585f7.cfargotunnel.com` (or your tunnel ID + `.cfargotunnel.com`)
3. For `node-social.com`: Add CNAME record (name: `@`) pointing to `7334cd6f-3105-4159-90eb-0a10658585f7.cfargotunnel.com`

### Step 6: Run the Tunnel

```bash
cloudflared tunnel run node-social-dev
```

Keep this running in a terminal. Your API will be available at `https://api.node-social.com` with automatic HTTPS!

## Option 2: Direct Cloudflare DNS (If you have a static IP)

If you have a static IP address and can port forward:

1. Go to Cloudflare Dashboard > DNS
2. Add an A record:
   - Name: `api` (or `@` for root)
   - IPv4: Your public IP
   - Proxy: ON (orange cloud) - this gives you HTTPS
3. Port forward port 80/443 on your router to your dev machine port 3000
4. Your API will be at `https://api.node-social.com`

## Updating Your App Configuration

Once your domain is set up, update your environment variables:

### Backend (.env)

```bash
# In backend/api/.env
PORT=3000
API_URL=https://api.node-social.com
```

### Frontend (app/.env or app.json)

Create `app/.env`:

```bash
EXPO_PUBLIC_API_URL=https://api.node-social.com
```

Or update `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://api.node-social.com"
    }
  }
}
```

## Updating Google OAuth Configuration

Now you can register proper HTTPS redirect URIs in Google Cloud Console:

1. Go to Google Cloud Console > APIs & Services > Credentials
2. Edit your **Web Client ID**
3. Under **Authorized redirect URIs**, add:
   - `https://api.node-social.com/auth/google/callback` (if you add a callback endpoint)
   - `https://node-social.com/auth/callback` (for web app if you build it)

For native mobile apps, you still don't need to add redirect URIs - they're handled automatically.

## Testing

1. Start your backend: `cd backend/api && npm run dev`
2. Start your frontend: `cd app && npm start`
3. If using Cloudflare Tunnel, keep `cloudflared tunnel run` running
4. Your API should be accessible at `https://api.node-social.com`
5. Test Google OAuth - it should work now!

## Pro Tips

- **Cloudflare Tunnel is perfect for dev** - no port forwarding, automatic HTTPS, works from anywhere
- **Keep tunnel running in a separate terminal** or use a process manager like `pm2`
- **For production**, consider using Cloudflare Workers, Railway, or Render for hosting
- **Test with friends** - they can access `https://api.node-social.com` from anywhere

## Troubleshooting

- **Tunnel not connecting**: Check that `cloudflared tunnel run` is running
- **DNS not resolving**: Wait a few minutes for DNS propagation
- **HTTPS errors**: Cloudflare Tunnel handles SSL automatically - no cert setup needed
- **CORS issues**: Make sure your backend CORS allows your domain

