#!/bin/bash
set -e
echo ""
echo "  Agent Safe — Setup Script v1.0"
echo "  CARD Developer Test Kit"
echo ""
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "  ERROR: .env file not found. Run: cp .env.example .env"
  exit 1
fi
source "$ENV_FILE"
if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" = "https://YOUR-PROJECT.supabase.co" ]; then
  echo "  ERROR: SUPABASE_URL is not set in .env"
  exit 1
fi
echo "  Credentials loaded. Supabase URL: $SUPABASE_URL"
echo ""
echo "  Run these SQL files IN ORDER in Supabase SQL Editor:"
echo "  (Dashboard -> SQL Editor -> New query -> paste -> Run)"
echo ""
echo "    1. schema/migrations/001-core-tables.sql"
echo "    2. schema/migrations/002-rls-policies.sql"
echo "    3. schema/migrations/003-rpcs-core.sql"
echo "    4. schema/migrations/004-rpcs-lifecycle.sql"
echo "    5. schema/migrations/005-payload-validation.sql"
echo "    6. schema/migrations/006-verification-endpoint.sql"
echo "    7. demo/seed/bob-bethany-demo-seed.sql"
echo ""
echo "  Then run: ./scripts/test-ve.sh"
