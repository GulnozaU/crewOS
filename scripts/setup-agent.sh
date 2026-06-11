#!/usr/bin/env bash
# Sync agent/.env from project .env.local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_LOCAL="$ROOT/.env.local"
AGENT_ENV="$ROOT/agent/crewoz_agent/.env"

if [[ ! -f "$ENV_LOCAL" ]]; then
  echo "Missing .env.local — create it first."
  exit 1
fi

GEMINI_KEY=$(grep '^GEMINI_API_KEY=' "$ENV_LOCAL" | cut -d= -f2- | tr -d ' ')
MONGO_URI=$(grep '^MONGODB_URI=' "$ENV_LOCAL" | cut -d= -f2- | tr -d ' ')
MODEL=$(grep '^GEMINI_MODEL=' "$ENV_LOCAL" | cut -d= -f2- | tr -d ' ' || echo "gemini-2.5-flash")

cat > "$AGENT_ENV" <<EOF
GOOGLE_API_KEY=${GEMINI_KEY}
GEMINI_MODEL=${MODEL:-gemini-2.5-flash}
MDB_MCP_CONNECTION_STRING=${MONGO_URI}
MONGODB_URI=${MONGO_URI}
EOF

echo "Wrote $AGENT_ENV"
echo "Next: cd agent && source .venv/bin/activate && adk web --port 8000"
