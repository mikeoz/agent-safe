#!/bin/bash
set -e
echo ""
echo "  Agent Safe VE Test Suite v1.0"
echo ""
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then echo "  ERROR: no .env"; exit 1; fi
source .env
VE="$SUPABASE_URL/functions/v1/verify-card"
KN="urn:uuid:5b3a4df1-d71b-4e8c-9c6d-22f12a95c358"
UN="urn:uuid:00000000-0000-0000-0000-000000000000"
P=0
F=0
echo "  Test 1/4: AUTHORIZED (known agent)"
R=(curl−s−o/dev/null−w"(curl -s -o /dev/null -w "%{http_code}" -H "x-api-key: $VERIFY_API_KEY" "
(curl−s−o/dev/null−w"VE?agent_id=$KN")
if [ "R"="200"];thenecho"PASS";P=R" = "200" ]; then echo "    PASS"; P=
R"="200"];thenecho"PASS";P=((P+1)); else echo "    FAIL (HTTP R)";F=R)"; F=
R)";F=((F+1)); fi
echo "  Test 2/4: DENIED (unknown agent)"
R=(curl−s−o/dev/null−w"(curl -s -o /dev/null -w "%{http_code}" -H "x-api-key: $VERIFY_API_KEY" "
(curl−s−o/dev/null−w"VE?agent_id=$UN")
if [ "R"="200"];thenecho"PASS";P=R" = "200" ]; then echo "    PASS"; P=
R"="200"];thenecho"PASS";P=((P+1)); else echo "    FAIL (HTTP R)";F=R)"; F=
R)";F=((F+1)); fi
echo "  Test 3/4: 401 UNAUTHORIZED (no key)"
R=(curl−s−o/dev/null−w"(curl -s -o /dev/null -w "%{http_code}" "
(curl−s−o/dev/null−w"VE?agent_id=$KN")
if [ "R"="401"];thenecho"PASS";P=R" = "401" ]; then echo "    PASS"; P=
R"="401"];thenecho"PASS";P=((P+1)); else echo "    FAIL (HTTP R)";F=R)"; F=
R)";F=((F+1)); fi
echo "  Test 4/4: 400 BAD REQUEST (no agent_id)"
R=(curl−s−o/dev/null−w"(curl -s -o /dev/null -w "%{http_code}" -H "x-api-key: $VERIFY_API_KEY" "
(curl−s−o/dev/null−w"VE")
if [ "R"="400"];thenecho"PASS";P=R" = "400" ]; then echo "    PASS"; P=
R"="400"];thenecho"PASS";P=((P+1)); else echo "    FAIL (HTTP R)";F=R)"; F=
R)";F=((F+1)); fi
echo ""
echo "  Results: $P passed, $F failed"
echo ""
exit $F
