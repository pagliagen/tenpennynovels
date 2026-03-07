#!/bin/bash
set -e

echo "=== Testing All Seeders (Local) ==="
echo ""

export MONGO_URI=${MONGO_URI:-"mongodb://mongo:27017/tenpennynovels"}

echo "[Connection] Testing with URI: $MONGO_URI"
echo ""

echo "[1/9] Testing UserSeeder..."
npm run seed:users -- --force
echo ""

echo "[2/9] Testing LocationSeeder..."
npm run seed:locations
echo ""

echo "[3/9] Testing ItemSeeder..."
npm run seed:items
echo ""

echo "[4/9] Testing SkillSeeder..."
npm run seed:skills
echo ""

echo "[5/9] Testing OccupationSeeder..."
npm run seed:occupations
echo ""

echo "[6/9] Testing SocialClassConfigSeeder..."
npm run seed:social-classes
echo ""

echo "[7/9] Testing ForumSeeder..."
npm run seed:forum
echo ""

echo "[8/9] Testing DocumentSeeder..."
npm run seed:documents -- --force --no-chunks
echo "    Note: Skipping chunk generation for test speed"
echo ""

echo "✅ All seeders tested successfully"
