#!/usr/bin/env bash
set -e

echo "=================================================="
echo "  🚀 Installing & Starting Mousely..."
echo "=================================================="

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js is not found. Please install Node.js from https://nodejs.org"
    exit 1
fi

# Clone or update
INSTALL_DIR="$HOME/.mousely"
if [ -d "$INSTALL_DIR" ]; then
    echo "📦 Updating Mousely..."
    cd "$INSTALL_DIR"
    git pull origin main 2>/dev/null || true
else
    echo "📦 Downloading Mousely..."
    git clone https://github.com/Nekono3/mousely.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo "⚙️  Checking dependencies..."
npm install --silent

echo "🌟 Launching Mousely..."
node server.js
