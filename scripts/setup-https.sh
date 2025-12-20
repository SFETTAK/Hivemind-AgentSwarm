#!/bin/bash
# =============================================================================
# Hivemind HTTPS Setup - Self-Signed Certificate Generator
# =============================================================================
# Creates a self-signed certificate for local HTTPS access.
# Run once, certificates are saved in ~/.hivemind/certs/
#
# Usage: ./setup-https.sh [domain]
#   domain: Optional, defaults to "localhost"
#
# After running, start the API with:
#   HIVEMIND_HTTPS=true pnpm start
# =============================================================================

set -e

DOMAIN="${1:-localhost}"
CERT_DIR="${HOME}/.hivemind/certs"
DAYS=365

echo "🔐 Hivemind HTTPS Setup"
echo "======================="
echo ""

# Create cert directory
mkdir -p "$CERT_DIR"

# Check if certs already exist
if [ -f "$CERT_DIR/server.key" ] && [ -f "$CERT_DIR/server.crt" ]; then
    echo "⚠️  Certificates already exist in $CERT_DIR"
    echo ""
    read -p "Regenerate? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing certificates."
        exit 0
    fi
fi

echo "📝 Generating self-signed certificate for: $DOMAIN"
echo ""

# Generate private key and certificate in one command
openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -days $DAYS \
    -subj "/CN=$DOMAIN/O=Hivemind/C=US" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1" \
    2>/dev/null

# Set permissions
chmod 600 "$CERT_DIR/server.key"
chmod 644 "$CERT_DIR/server.crt"

echo "✅ Certificates generated!"
echo ""
echo "📁 Location:"
echo "   Key:  $CERT_DIR/server.key"
echo "   Cert: $CERT_DIR/server.crt"
echo ""
echo "🚀 To start Hivemind with HTTPS:"
echo ""
echo "   HIVEMIND_HTTPS=true pnpm start"
echo ""
echo "   Or set in your environment:"
echo "   export HIVEMIND_HTTPS=true"
echo "   export HIVEMIND_CERT_DIR=$CERT_DIR"
echo ""
echo "🌐 Access at: https://localhost:3001"
echo ""
echo "⚠️  Browser will show security warning (self-signed cert)"
echo "   Click 'Advanced' → 'Proceed' to continue"
echo ""

# Optional: Trust the cert on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 macOS detected. To trust this certificate system-wide:"
    echo ""
    echo "   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $CERT_DIR/server.crt"
    echo ""
fi

# Optional: Trust on Linux
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 Linux detected. To trust this certificate:"
    echo ""
    echo "   # Ubuntu/Debian:"
    echo "   sudo cp $CERT_DIR/server.crt /usr/local/share/ca-certificates/hivemind.crt"
    echo "   sudo update-ca-certificates"
    echo ""
    echo "   # Fedora/RHEL:"
    echo "   sudo cp $CERT_DIR/server.crt /etc/pki/ca-trust/source/anchors/"
    echo "   sudo update-ca-trust"
    echo ""
fi

