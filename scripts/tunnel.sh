#!/bin/sh
# Browserbase browsers run in the cloud and cannot see localhost, so the demo sites
# get a temporary public URL from a cloudflared quick tunnel (no account needed).
# The URL is written to .sloth/tunnel-url, which the worker reads when SLOTH_BROWSER=browserbase.
# Saved logins are per hostname, so run `bun run login library` (and gym) again after a new tunnel.
cd "$(dirname "$0")/.." || exit 1
mkdir -p .sloth
rm -f .sloth/tunnel-url
cloudflared tunnel --no-autoupdate --url "http://localhost:${DEMO_SITES_PORT:-4100}" 2>&1 | while read -r line; do
  url=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com')
  if [ -n "$url" ] && [ ! -f .sloth/tunnel-url ]; then
    echo "$url" > .sloth/tunnel-url
    echo "Demo sites are public at $url"
  fi
done
