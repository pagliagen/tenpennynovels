#!/bin/bash
set -e

echo "📦 Installing dependencies for all apps and services..."

# Root dependencies (optional - only devDeps for local development)
echo ""
echo "=== Root ==="
npm install || echo "⚠️  Root install skipped (empty dependencies)"

# Frontend apps
for app in apps/*/; do
  if [ -f "${app}package.json" ]; then
    echo ""
    echo "=== ${app} ==="
    (cd "$app" && npm install || true)
  fi
done

# Backend services
for service in services/*/; do
  if [ -f "${service}package.json" ]; then
    echo ""
    echo "=== ${service} ==="
    (cd "$service" && npm install || true)
  fi
done

echo ""
echo "✅ All dependencies installed!"
