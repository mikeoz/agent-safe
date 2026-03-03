#!/bin/bash
set -e
echo ""
echo "  Agent Safe VE Test Suite v1.0"
echo ""
cd "$(dirname "$0")/.."
source .env
VE="$SUPABASE_URL/functions/v1/verify-card"
KN="urn:uuid:5b3a4df1-d71b-4e8c-9c6d-22f12a95c358"
UN="urn:uuid:00000000-0000-0000-0000-000000000000"
P=0
F=0
echo "  Test 1/4: AUTHORIZED"
C=$(curl -s -o /dev/null -w '%{http_code}' -H "x-api-key: $VERIFY_API_KEY" "$VE?agent_id=$KN")
if [ "$C" = "200" ]; then echo "    PASS"; P=$((P+1)); else echo "    FAIL ($C)"; F=$((F+1)); fi
echo "  Test 2/4: DENIED"
C=$(curl -s -o /dev/null -w '%{http_code}' -H "x-api-key: $VERIFY_API_KEY" "$VE?agent_id=$UN")
if [ "$C" = "200" ]; then echo "    PASS"; P=$((P+1)); else echo "    FAIL ($C)"; F=$((F+1)); fi
echo "  Test 3/4: 401 NO KEY"
C=$(curl -s -o /dev/null -w '%{http_code}' "$VE?agent_id=$KN")
if [ "$C" = "401" ]; then echo "    PASS"; P=$((P+1)); else echo "    FAIL ($C)"; F=$((F+1)); fi
echo "  Test 4/4: 400 NO AGENT"
C=$(curl -s -o /dev/null -w '%{http_code}' -H "x-api-key: $VERIFY_API_KEY" "$VE")
if [ "$C" = "400" ]; then echo "    PASS"; P=$((P+1)); else echo "    FAIL ($C)"; F=$((F+1)); fi
echo ""
echo "  Results: $P passed, $F failed"
exit $F
