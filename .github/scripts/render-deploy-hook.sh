#!/usr/bin/env bash
# Calls a Render Deploy Hook and verifies Render actually created a deploy.
# Env: HOOK (secret URL), SECRET_NAME, SERVICE. Never prints the hook URL itself.
set -euo pipefail

if [ -z "${HOOK:-}" ]; then
  echo "::warning::${SECRET_NAME} secret is not set; skipping ${SERVICE} deploy."
  exit 0
fi

host=$(printf '%s' "$HOOK" | sed -E 's#^[a-zA-Z]+://([^/?]+).*#\1#')
path_prefix=$(printf '%s' "$HOOK" | sed -E 's#^[a-zA-Z]+://[^/?]+(/deploy/srv-[a-z0-9]+)?.*#\1#' | sed -E 's#/deploy/##')

response=$(curl -sS --retry 3 --retry-delay 5 -w '\n%{http_code}' -X POST "$HOOK" || true)
status=$(printf '%s' "$response" | tail -n1)
body=$(printf '%s' "$response" | sed '$d')
deploy_id=$(printf '%s' "$body" | grep -oE 'dep-[a-z0-9]+' | head -1 || true)

if [ "$host" != "api.render.com" ] || [ -z "$path_prefix" ]; then
  echo "::error::${SECRET_NAME} does not look like a Render Deploy Hook URL (host: ${host}). Expected https://api.render.com/deploy/srv-...?key=..."
  exit 1
fi
if [ "${status:0:1}" != "2" ] || [ -z "$deploy_id" ]; then
  echo "::error::${SERVICE}: Render hook for service ${path_prefix} returned HTTP ${status} without a deploy id."
  exit 1
fi
echo "::notice::${SERVICE}: Render created deploy ${deploy_id} for service ${path_prefix}."
