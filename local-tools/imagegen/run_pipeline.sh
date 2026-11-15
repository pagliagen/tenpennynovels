#!/usr/bin/env bash
# Genera gli artifact (items, occupations, locations) con x/z-image-turbo via Ollama.
# Nessun server da avviare: basta l'app Ollama accesa e il modello scaricato.
#
# Uso:  bash run_pipeline.sh --type items|occupations|locations|all [altri flag di generate_artifacts.py]
#   bash run_pipeline.sh --type locations --dry-run
#   bash run_pipeline.sh --type items --test
#   bash run_pipeline.sh --type items --only "Stetoscopio" --overwrite
set -euo pipefail
cd "$(dirname "$0")"

[ -d .venv ] || { echo "❌ manca .venv — python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"; exit 1; }
# shellcheck disable=SC1091
source .venv/bin/activate
python generate_artifacts.py "$@"
echo ""
echo "✨ Fatto. Artifact in ../../apps/game/public/artifacts/"
