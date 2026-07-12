#!/usr/bin/env bash
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
mkdir -p "$NVM_DIR"

echo "Installing nvm (installer v0.39.8) using available transport..."

if command -v curl >/dev/null 2>&1; then
  echo "Using curl to install nvm"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.8/install.sh | bash
elif command -v wget >/dev/null 2>&1; then
  echo "Using wget to install nvm"
  wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.8/install.sh | bash
elif command -v git >/dev/null 2>&1; then
  echo "Using git to clone nvm"
  git clone https://github.com/nvm-sh/nvm.git "$NVM_DIR"
  cd "$NVM_DIR"
  git checkout v0.39.8 || true
else
  echo "ERROR: curl, wget, and git are all unavailable. Cannot install nvm." >&2
  exit 1
fi

# shellcheck source=/dev/null
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
else
  echo "ERROR: nvm installation did not produce $NVM_DIR/nvm.sh" >&2
  exit 1
fi

echo "Installing Node LTS via nvm"
nvm install --lts
nvm use --lts
nvm alias default 'lts/*' || true

echo "Node and npm versions:"
node -v
npm -v

# Install project dependencies
PROJECT_DIR="/home/adam/TrippinTV_AI"
if [ -d "$PROJECT_DIR" ]; then
  echo "Installing npm dependencies in $PROJECT_DIR"
  cd "$PROJECT_DIR"
  npm install --no-audit --no-fund --silent
else
  echo "ERROR: project directory not found: $PROJECT_DIR" >&2
  exit 1
fi

echo "Done."
