# Setting Up node-social.com Domain

Both `api.node-social.com` and `node-social.com` are already resolving via DNS, but we need to make sure they're routed through your Cloudflare Tunnel.

## Current Status

- ✅ Tunnel is running: `node-social-dev` (ID: `7334cd6f-3105-4159-90eb-0a10658585f7`)
- ✅ Tunnel config includes both domains
- ✅ DNS is resolving (both domains point to Cloudflare)
- ❓ Need to verify routing through tunnel

## Option 1: Set Up DNS Records in Regular Cloudflare Dashboard (Easiest)

No need for Zero Trust signup! Just update DNS records in the regular dashboard:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your `node-social.com` domain
3. Go to **DNS** > **Records**
4. Look for existing CNAME records for `api` and `@` (root)
5. Update or create them:
   
   **For api.node-social.com:**
   - **Type**: CNAME
   - **Name**: `api`
   - **Target**: `7334cd6f-3105-4159-90eb-0a10658585f7.cfargotunnel.com`
   - **Proxy status**: **Proxied** (orange cloud) - click to turn on if gray
   - Click **Save**
   
   **For node-social.com (root domain):**
   - **Type**: CNAME
   - **Name**: `@` (or leave blank for root)
   - **Target**: `7334cd6f-3105-4159-90eb-0a10658585f7.cfargotunnel.com`
   - **Proxy status**: **Proxied** (orange cloud) - click to turn on if gray
   - Click **Save**

That's it! The tunnel config file already knows how to route traffic, so once DNS points to the tunnel, it should work.

**Note**: The tunnel config is set to route `node-social.com` to `http://localhost:8081`. If your Expo web server uses a different port, update the tunnel config file at `~/.cloudflared/config.yml` and restart the tunnel.

**Important**: Make sure the **Proxy status** shows an **orange cloud** (proxied), not a gray cloud (DNS only). Click the cloud icon to toggle if needed.

## Verify Your Tunnel is Running

Make sure your tunnel is running:

```bash
cloudflared tunnel run node-social-dev
```

Or check if it's already running:

```bash
cloudflared tunnel info node-social-dev
```

## Start Your Services

Once routing is set up:

1. **Backend API** (required for `api.node-social.com`):
   ```bash
   cd backend/api
   npm run dev
   ```

2. **Expo Web App** (required for `node-social.com`):
   ```bash
   cd app
   npm run web
   # Or: npx expo start --web
   ```
   This will start the Expo web server on `http://localhost:8081` (the default Expo web port).

## Testing

1. Test API: Visit `https://api.node-social.com` - should show your API
2. Test web app: Visit `https://node-social.com` - should show your Expo web app

## Troubleshooting

- **404 errors**: Make sure the tunnel is running AND the local services are running
- **DNS not updating**: Wait a few minutes for DNS propagation
- **Connection refused**: Check that your local services are running on the correct ports
- **Tunnel not connecting**: Restart the tunnel: `cloudflared tunnel run node-social-dev`

