#!/bin/bash
# PM2 wrapper script for embeddings service
# Activates venv before running Python

cd "$(dirname "$0")"
source venv/bin/activate

# Force offline mode to use only local cache (avoid HuggingFace 429 rate limits)
export HF_HUB_OFFLINE=1

exec python3 embeddings_service.py
