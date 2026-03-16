#!/bin/bash
set -e

echo "📦 Installing dependencies for all apps and services..."

# Root dependencies
echo ""
echo "=== Root ==="
npm install
npm audit fix --force || true  # Don't fail if audit fix fails

# Frontend apps
for app in apps/*/; do
  if [ -f "${app}package.json" ]; then
    echo ""
    echo "=== ${app} ==="
    (cd "$app" && npm install && npm audit fix --force || true)
  fi
done

# Backend services
for service in services/*/; do
  if [ -f "${service}package.json" ]; then
    echo ""
    echo "=== ${service} ==="
    (cd "$service" && npm install && npm audit fix --force || true)
  fi
done

(cd "services/unified-backend/src/shared" && npm install && npm audit fix --force || true)

echo ""
echo "✅ All dependencies installed!"
