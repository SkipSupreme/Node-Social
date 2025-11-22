#!/bin/bash

# Quick setup script for node-social.com domain with Cloudflare Tunnel
# Run this after installing cloudflared

echo "🚀 Setting up node-social.com domain with Cloudflare Tunnel"
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared is not installed"
    echo "Install it with: brew install cloudflare/cloudflare/cloudflared"
    echo "Or download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
    exit 1
fi

echo "✅ cloudflared is installed"
echo ""

# Step 1: Login
echo "Step 1: Authenticating with Cloudflare..."
echo "This will open a browser window - please log in and select node-social.com"
cloudflared tunnel login

if [ $? -ne 0 ]; then
    echo "❌ Login failed"
    exit 1
fi

echo "✅ Authenticated"
echo ""

# Step 2: Create tunnel (or use existing)
echo "Step 2: Checking for existing tunnel..."
TUNNEL_NAME="node-social-dev"

# Check if tunnel already exists
EXISTING_TUNNEL=$(cloudflared tunnel list 2>/dev/null | grep "$TUNNEL_NAME" | awk '{print $1}')

if [ -n "$EXISTING_TUNNEL" ]; then
    echo "✅ Tunnel already exists: $EXISTING_TUNNEL"
    TUNNEL_ID="$EXISTING_TUNNEL"
else
    echo "Creating new tunnel..."
    TUNNEL_OUTPUT=$(cloudflared tunnel create $TUNNEL_NAME 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create tunnel"
        echo "$TUNNEL_OUTPUT"
        exit 1
    fi
    
    # Extract tunnel ID from output (works with BSD grep on macOS)
    # The output format is: "Created tunnel <tunnel-id>"
    TUNNEL_ID=$(echo "$TUNNEL_OUTPUT" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
    
    if [ -z "$TUNNEL_ID" ]; then
        # Try alternative extraction method using sed
        TUNNEL_ID=$(echo "$TUNNEL_OUTPUT" | sed -n 's/.*Created tunnel \([a-f0-9-]\+\).*/\1/p' | head -1)
    fi
    
    if [ -z "$TUNNEL_ID" ]; then
        echo "⚠️  Could not extract tunnel ID automatically"
        echo "Tunnel creation output:"
        echo "$TUNNEL_OUTPUT"
        echo ""
        echo "Please manually find the tunnel ID from the output above"
        echo "It should look like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        echo ""
        read -p "Enter the tunnel ID manually (or press Ctrl+C to cancel): " TUNNEL_ID
        
        if [ -z "$TUNNEL_ID" ]; then
            echo "❌ No tunnel ID provided"
            exit 1
        fi
    fi
fi

echo "✅ Tunnel created: $TUNNEL_ID"
echo ""

# Step 3: Create config directory
CONFIG_DIR="$HOME/.cloudflared"
mkdir -p "$CONFIG_DIR"

# Step 4: Create config file
echo "Step 3: Creating config file..."
cat > "$CONFIG_DIR/config.yml" << EOF
tunnel: $TUNNEL_ID
credentials-file: $CONFIG_DIR/$TUNNEL_ID.json

ingress:
  # Route API traffic to your backend
  - hostname: api.node-social.com
    service: http://localhost:3000
  
  # Route web app traffic (if you build web version)
  - hostname: node-social.com
    service: http://localhost:19006
  
  # Catch-all (must be last)
  - service: http_status:404
EOF

echo "✅ Config file created at $CONFIG_DIR/config.yml"
echo ""

# Step 5: Route DNS
echo "Step 4: Routing DNS..."
cloudflared tunnel route dns $TUNNEL_NAME api.node-social.com
cloudflared tunnel route dns $TUNNEL_NAME node-social.com

if [ $? -ne 0 ]; then
    echo "⚠️  DNS routing may have failed - you may need to do this manually"
else
    echo "✅ DNS routed"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start your backend: cd backend/api && npm run dev"
echo "2. Start the tunnel: cloudflared tunnel run $TUNNEL_NAME"
echo "3. Your API will be available at: https://api.node-social.com"
echo ""
echo "To run the tunnel in the background, use:"
echo "  cloudflared tunnel run $TUNNEL_NAME &"
echo ""
echo "Or use a process manager like pm2:"
echo "  pm2 start cloudflared --name tunnel -- tunnel run $TUNNEL_NAME"

