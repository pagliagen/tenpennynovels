#!/usr/bin/env bash
# Esegue un comando remoto via SSH sul server configurato in .env (stessa cartella).
#
# Uso:  bash run.sh "<comando remoto>"
# Es.:  bash run.sh "pm2 status"
#       bash run.sh "pm2 logs tenpennynovels-documents --lines 100 --nostream"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SKILL_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRORE: manca $ENV_FILE" >&2
  echo "Crealo:  cp \"$SKILL_DIR/.env.example\" \"$ENV_FILE\"  e compila le credenziali." >&2
  exit 1
fi

# Parsing sicuro: NON usa `source`, così valori con caratteri speciali
# (parentesi, $, spazi, ecc.) non vengono interpretati dalla shell.
while IFS= read -r __line || [[ -n "$__line" ]]; do
  __line="${__line%$'\r'}"                                  # toglie CR (Windows)
  __line="${__line#"${__line%%[![:space:]]*}"}"             # ltrim
  [[ -z "$__line" || "$__line" == '#'* ]] && continue
  [[ "$__line" != *=* ]] && continue
  __key="${__line%%=*}"
  __key="${__key%"${__key##*[![:space:]]}"}"                # rtrim key
  [[ "$__key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
  __val="${__line#*=}"
  __val="${__val%% #*}"                                     # toglie commento inline " #..."
  __val="${__val#"${__val%%[![:space:]]*}"}"                # ltrim val
  __val="${__val%"${__val##*[![:space:]]}"}"                # rtrim val
  if [[ ${#__val} -ge 2 && ( ( "${__val:0:1}" == '"' && "${__val: -1}" == '"' ) \
        || ( "${__val:0:1}" == "'" && "${__val: -1}" == "'" ) ) ]]; then
    __val="${__val:1:${#__val}-2}"                          # toglie virgolette
  fi
  # precedenza a variabili già impostate nell'ambiente (override da CLI)
  if [[ -z "${!__key:-}" ]]; then
    printf -v "$__key" '%s' "$__val"
  fi
  export "$__key"
done < "$ENV_FILE"

: "${SSH_HOST:?manca SSH_HOST nel .env}"
: "${SSH_USER:?manca SSH_USER nel .env}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"

if [[ $# -lt 1 ]]; then
  echo "ERRORE: nessun comando specificato." >&2
  echo "Uso: bash run.sh \"<comando remoto>\"" >&2
  exit 1
fi

SSH_OPTS=(-p "$SSH_PORT" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)

if [[ -n "$SSH_KEY" ]]; then
  KEY="${SSH_KEY/#\~/$HOME}"
  if [[ ! -f "$KEY" ]]; then
    echo "ERRORE: chiave SSH non trovata: $KEY" >&2
    exit 1
  fi
  chmod 600 "$KEY" 2>/dev/null || true
  SSH_OPTS=(-i "$KEY" "${SSH_OPTS[@]}")
fi

echo "→ ${SSH_USER}@${SSH_HOST}:${SSH_PORT}" >&2
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" -- "$@"
