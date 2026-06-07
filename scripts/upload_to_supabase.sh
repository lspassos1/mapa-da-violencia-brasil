#!/usr/bin/env bash
# Publica a carga nacional gzipped no Supabase Storage (bucket publico crime-data),
# que o app consome no modo NEXT_PUBLIC_CRIME_DATA_MODE=supabase.
#
# Credenciais lidas do ambiente (NUNCA hardcoded/committed):
#   SUPABASE_URL=https://<ref>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=<service_role>   # secreto
#
# Uso:
#   export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
#   scripts/upload_to_supabase.sh [ficheiro.gz] [nome-no-bucket]
set -euo pipefail
cd "$(dirname "$0")/.."

: "${SUPABASE_URL:?defina SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?defina SUPABASE_SERVICE_ROLE_KEY}"

FILE="${1:-public/officialCrimeData.json.gz}"
OBJECT="${2:-current.json.gz}"
BUCKET="crime-data"

# Garante o bucket publico (ignora erro se ja existir).
curl -sS -X POST "$SUPABASE_URL/storage/v1/bucket" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$BUCKET\",\"name\":\"$BUCKET\",\"public\":true}" >/dev/null || true

echo "==> A enviar $FILE -> $BUCKET/$OBJECT"
# --fail: um 4xx/5xx do Storage (403, 413 ficheiro grande, etc.) faz o curl
# sair com erro e, com `set -e`, aborta o script — em vez de reportar sucesso
# falso. -w mostra o status HTTP.
curl -fsS -w "HTTP %{http_code}\n" -X POST "$SUPABASE_URL/storage/v1/object/$BUCKET/$OBJECT" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/gzip" -H "x-upsert: true" \
  --data-binary "@$FILE"
echo ""
echo "Publico em: $SUPABASE_URL/storage/v1/object/public/$BUCKET/$OBJECT"
