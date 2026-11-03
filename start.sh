#!/bin/sh
set -e

# Find and start bgutil POT provider in the background if available
POT_MAIN=""
for p in /opt/bgutil/build/main.js /opt/bgutil/main.js /opt/bgutil/dist/main.js /opt/bgutil/server/build/main.js /opt/bgutil/src/main.ts; do
  if [ -f "$p" ]; then
    POT_MAIN="$p"
    break
  fi
done

if [ -n "$POT_MAIN" ]; then
    echo "[start.sh] Starting bgutil POT Provider from $POT_MAIN on port 4416..."
    if echo "$POT_MAIN" | grep -q "\.ts$"; then
        deno run -A "$POT_MAIN" --port 4416 --host 127.0.0.1 > /tmp/bgutil.log 2>&1 &
    else
        node "$POT_MAIN" --port 4416 --host 127.0.0.1 > /tmp/bgutil.log 2>&1 &
    fi
    sleep 2
    echo "[start.sh] bgutil POT Provider running in background."
else
    echo "[start.sh] Notice: bgutil POT provider binary not found at standard paths. Listing /opt/bgutil:"
    ls -la /opt/bgutil || true
fi

# Start Next.js server
echo "[start.sh] Starting Next.js server on port ${PORT:-3000}..."
exec npm run start
