#!/usr/bin/env bash
set -e

echo "=================================================="
echo "  🚀 Mousely Auto-Setup & Launch"
echo "=================================================="

INSTALL_DIR="$HOME/.mousely"
mkdir -p "$INSTALL_DIR"

# 1. Ensure Node.js is available
if ! command -v node &> /dev/null && [ ! -f "$INSTALL_DIR/bin/node" ]; then
    echo "⚙️  Setting up portable Node.js runtime (one-time setup)..."
    ARCH=$(uname -m)
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    NODE_VER="v20.18.0"

    if [ "$OS" = "darwin" ]; then
        if [ "$ARCH" = "arm64" ]; then
            TAR_NAME="node-${NODE_VER}-darwin-arm64"
        else
            TAR_NAME="node-${NODE_VER}-darwin-x64"
        fi
    elif [ "$OS" = "linux" ]; then
        if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
            TAR_NAME="node-${NODE_VER}-linux-arm64"
        else
            TAR_NAME="node-${NODE_VER}-linux-x64"
        fi
    else
        echo "⚠️  Unsupported OS for auto-node. Please install Node.js from https://nodejs.org"
        exit 1
    fi

    echo "📥 Downloading portable Node.js for ${OS}-${ARCH}..."
    curl -fsSL "https://nodejs.org/dist/${NODE_VER}/${TAR_NAME}.tar.gz" -o "/tmp/${TAR_NAME}.tar.gz"
    tar -xzf "/tmp/${TAR_NAME}.tar.gz" -C "$INSTALL_DIR" --strip-components=1
    rm -f "/tmp/${TAR_NAME}.tar.gz"
    echo "✅ Portable Node.js ready!"
fi

# Add local bin to PATH if present
if [ -d "$INSTALL_DIR/bin" ]; then
    export PATH="$INSTALL_DIR/bin:$PATH"
fi

# 2. Clone or update Mousely
if [ -d "$INSTALL_DIR/app" ]; then
    echo "📦 Updating Mousely..."
    cd "$INSTALL_DIR/app"
    git pull origin main 2>/dev/null || true
else
    echo "📦 Downloading Mousely..."
    git clone https://github.com/Nekono3/mousely.git "$INSTALL_DIR/app"
    cd "$INSTALL_DIR/app"
fi

echo "⚙️  Verifying dependencies..."
npm install --silent

echo ""
echo "=================================================="
echo "  🌟 Starting Mousely Presentation Hub..."
echo "=================================================="
echo ""
node server.js
