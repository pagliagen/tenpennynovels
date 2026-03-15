#!/bin/bash
set -e

echo "📦 Installing dependencies for all apps and services..."

# Root dependencies
echo ""
echo "=== Root ==="
rm -rf node_modules package-lock.json
npm install
npm audit fix --force || true  # Don't fail if audit fix fails

# Frontend apps
for app in apps/*/; do
  if [ -f "${app}package.json" ]; then
    echo ""
    echo "=== ${app} ==="
    (cd "$app" && rm -rf node_modules package-lock.json && npm install && npm audit fix --force || true)
  fi
done

# Backend services
for service in services/*/; do
  if [ -f "${service}package.json" ]; then
    echo ""
    echo "=== ${service} ==="
    (cd "$service" && rm -rf node_modules package-lock.json && npm install && npm audit fix --force || true)
  fi
done

echo ""
echo "✅ All dependencies installed!"
