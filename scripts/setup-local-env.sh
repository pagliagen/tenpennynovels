#!/bin/bash
#
# Setup ambiente locale TenpennyNovels: installa TUTTE le dipendenze npm
# (root, apps/*, services/*, local-ai, scripts/*) e crea il venv Python
# per embeddings-worker. Lanciare una volta sola dopo un checkout pulito
# o dopo un cambio di versione Node/Python.
#
# Uso: ./scripts/setup-local-env.sh
#

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FAILED=()
SKIPPED_PY=false

# ---------------------------------------------------------------------------
# 1. Verifica versione Node attiva rispetto a .nvmrc
# ---------------------------------------------------------------------------
REQUIRED_NODE="$(tr -d 'v[:space:]' < .nvmrc)"
CURRENT_NODE="$(node --version 2>/dev/null | tr -d 'v')"

echo "🔎 Node richiesto (.nvmrc): v${REQUIRED_NODE}"
echo "🔎 Node attivo:             v${CURRENT_NODE:-non trovato}"

if [ "$CURRENT_NODE" != "$REQUIRED_NODE" ]; then
  echo ""
  echo "⚠️  La versione Node attiva NON corrisponde a .nvmrc."
  if command -v nvm >/dev/null 2>&1 || [ -s "$NVM_DIR/nvm.sh" ]; then
    echo "   nvm è disponibile in questa shell: eseguo 'nvm install && nvm use'..."
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install
    nvm use
  else
    echo "   nvm non risulta caricato in questa shell (script non interattivo/non-login)."
    echo "   Esegui manualmente 'nvm install && nvm use' e rilancia lo script."
    read -p "   Continuare comunque con la versione Node attuale? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi

echo ""
echo "=================================================================="
echo "📦 npm install su tutte le app/servizi"
echo "=================================================================="

# NOTA: "local-ai" usa npm workspaces reali (gateway + services/*), quindi
# un solo "npm install" nella sua root installa anche gateway e tutti i
# services/* — NON vanno installati separatamente (a differenza del resto
# del monorepo, che non usa workspaces npm, vedi .claude/rules/02-node-environment.md).
NPM_DIRS=(
  "."
  "apps/landing"
  "apps/game"
  "apps/documents"
  "apps/management"
  "services/api-gateway"
  "services/unified-backend"
  "services/embeddings-worker"
  "local-ai"
  "scripts/glass-ball"
  "scripts/seeders"
)

for dir in "${NPM_DIRS[@]}"; do
  if [ ! -f "$dir/package.json" ]; then
    echo "⏭️  ${dir}: package.json non trovato, salto"
    continue
  fi

  echo ""
  echo "--- ${dir} ---"
  if (cd "$dir" && npm install); then
    echo "✅ ${dir} OK"
  else
    echo "❌ ${dir} FALLITO"
    FAILED+=("npm:${dir}")
  fi
done

# ---------------------------------------------------------------------------
# 2. Venv Python per embeddings-worker (unico servizio con subprocess Python)
# ---------------------------------------------------------------------------
echo ""
echo "=================================================================="
echo "🐍 Setup venv Python (embeddings-worker)"
echo "=================================================================="

PY_DIR="services/embeddings-worker/python"

if [ ! -f "$PY_DIR/requirements.txt" ]; then
  echo "⏭️  ${PY_DIR}: requirements.txt non trovato, salto"
  SKIPPED_PY=true
else
  PYTHON_BIN="$(command -v python3 || true)"
  if [ -z "$PYTHON_BIN" ]; then
    echo "❌ python3 non trovato nel PATH"
    FAILED+=("python3:not-found")
  else
    echo "--- ${PY_DIR} (python: $($PYTHON_BIN --version)) ---"
    if (
      cd "$PY_DIR" && \
      "$PYTHON_BIN" -m venv venv && \
      # shellcheck disable=SC1091
      source venv/bin/activate && \
      pip install --upgrade pip && \
      pip install -r requirements.txt && \
      echo "⬇️  Pre-download modelli HuggingFace (setup-models.py)..." && \
      python3 setup-models.py
    ); then
      echo "✅ ${PY_DIR} OK (venv creato in ${PY_DIR}/venv)"
    else
      echo "❌ ${PY_DIR} FALLITO"
      FAILED+=("python:${PY_DIR}")
    fi
  fi
fi

# ---------------------------------------------------------------------------
# 3. Riepilogo
# ---------------------------------------------------------------------------
echo ""
echo "=================================================================="
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "✅ Setup completato senza errori."
  $SKIPPED_PY && echo "   (venv Python saltato: requirements.txt non trovato)"
  exit 0
else
  echo "⚠️  Setup completato con errori nei seguenti step:"
  for f in "${FAILED[@]}"; do
    echo "   - $f"
  done
  echo "Rilancia lo script dopo aver risolto i problemi sopra (è idempotente)."
  exit 1
fi
