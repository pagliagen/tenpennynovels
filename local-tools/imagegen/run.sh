#!/usr/bin/env bash
# Avvio a un comando del servizio immagini locale (Stable Diffusion 1.5 di
# default — vedi server.py per il perché non SDXL). Crea la venv, installa le
# dipendenze e avvia il server su :8791.
#
#   bash run.sh
#
# Consigliato Python 3.11/3.12 (wheel ML più solide della 3.13). run.sh sceglie
# da solo la migliore Python disponibile.
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "${PY:-}" ]; then
  for c in python3.11 python3.12 python3; do
    command -v "$c" >/dev/null 2>&1 && PY="$c" && break
  done
fi
PORT="${PORT:-8791}"
echo "→ uso $PY ($($PY --version 2>&1))"

if [ ! -d .venv ]; then
  echo "→ creo la venv con $PY"
  "$PY" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

python -m pip install -q -U pip
python -m pip install -q -r requirements.txt

echo "→ modello: ${IMAGEGEN_MODEL:-runwayml/stable-diffusion-v1-5}"
[ -n "${IMAGEGEN_LORA:-}" ] && echo "→ LoRA:    ${IMAGEGEN_LORA}"
echo "→ avvio imagegen su http://0.0.0.0:${PORT} (primo avvio: scarica il modello, anche vari GB)"
exec uvicorn server:app --host 0.0.0.0 --port "${PORT}"
