#!/usr/bin/env bash
# Avvia il server una volta e genera tutti gli artifact di un tipo in un solo
# giro (nessun riavvio tra un elemento e l'altro):
#
# Uso:  bash run_pipeline.sh --type items|locations [altri flag di generate_artifacts.py]
#   bash run_pipeline.sh --type items --test --steps 8               # test veloce
#   bash run_pipeline.sh --type items                                # tutti gli item (400x400)
#   bash run_pipeline.sh --type locations                            # tutte le location (1024x1024)
#   bash run_pipeline.sh --type items --skip-existing                # riprende un run interrotto
#
# Modello via env (default: SD1.5 — stabile su MPS, vedi server.py per il perché
# non SDXL: SDXL con bf16+VAE-tiling produce artefatti intermittenti dipendenti
# dal seed):
#   IMAGEGEN_MODEL   default: runwayml/stable-diffusion-v1-5
#   IMAGEGEN_LORA / IMAGEGEN_LORA_SCALE   LoRA opzionale (solo SDXL/SD)
set -euo pipefail
cd "$(dirname "$0")"

MODEL="${IMAGEGEN_MODEL:-runwayml/stable-diffusion-v1-5}"
PORT="${PORT:-8791}"

[ -d .venv ] || { echo "❌ manca .venv — lancia prima 'bash run.sh' una volta"; exit 1; }
# shellcheck disable=SC1091
source .venv/bin/activate

# libera la porta da eventuali server precedenti
lsof -ti:"${PORT}" | xargs kill -9 2>/dev/null || true
sleep 1

echo "═══ avvio server · modello: ${MODEL} ═══"
IMAGEGEN_MODEL="${MODEL}" IMAGEGEN_LORA="${IMAGEGEN_LORA:-}" IMAGEGEN_LORA_SCALE="${IMAGEGEN_LORA_SCALE:-0.8}" \
  python -m uvicorn server:app --host 127.0.0.1 --port "${PORT}" >/tmp/imagegen_server.log 2>&1 &
SERVER_PID=$!
stop_server() { kill "${SERVER_PID}" 2>/dev/null || true; wait "${SERVER_PID}" 2>/dev/null || true; }
trap stop_server EXIT

echo -n "   attendo il server"
for _ in $(seq 1 240); do   # fino a ~20 min (primo avvio scarica il modello)
  if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then echo " ✓"; break; fi
  echo -n "."; sleep 5
done
curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1 || { echo " ✗ timeout"; tail -20 /tmp/imagegen_server.log; exit 1; }

echo ""
python generate_artifacts.py "$@"

echo ""
echo "✨ Pipeline completata. Artifact in ../../apps/game/public/artifacts/"
