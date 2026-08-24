#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="silent-violet-94567844"
BRANCH_ID="br-young-snow-ax2vm8ck"
GATEWAY_BASE_URL="https://br-young-snow-ax2vm8ck-api.ai.c-4.us-east-2.aws.neon.tech"

echo "Creating AI Gateway credential..."
RESPONSE=$(neon api POST "/projects/${PROJECT_ID}/branches/${BRANCH_ID}/credentials" \
  --data "{\"scopes\":[\"ai_gateway:invoke\"],\"principal_type\":\"user\"}" \
  -o json 2>/dev/null || true)

if [[ -z "${RESPONSE}" ]]; then
  echo "If neon api POST failed, create the credential in the Neon Console:"
  echo "Branch -> Credentials -> Create credential -> ai_gateway:invoke"
  exit 1
fi

TOKEN=$(printf '%s' "$RESPONSE" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("token",""))')

cat > .env.local <<EOF
DATABASE_URL=${DATABASE_URL:-replace-me}
NEON_AI_GATEWAY_BASE_URL=${GATEWAY_BASE_URL}
NEON_AI_GATEWAY_TOKEN=${TOKEN}
EOF

echo "Wrote .env.local with gateway token."
