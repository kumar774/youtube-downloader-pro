#!/bin/sh
set -e

# Start bgutil-pot server on port 4416
if [ -x "/usr/local/bin/bgutil-pot" ]; then
    echo "[start.sh] Starting bgutil-pot Rust server on port 4416..."
    /usr/local/bin/bgutil-pot server > /tmp/bgutil.log 2>&1 &
    sleep 1
    echo "[start.sh] bgutil-pot running in background."
elif [ -d "/opt/bgutil" ] && [ -f "/opt/bgutil/build/main.js" ]; then
    echo "[start.sh] Starting bgutil Node server..."
    cd /opt/bgutil
    node build/main.js --port 4416 --host 127.0.0.1 > /tmp/bgutil.log 2>&1 &
    cd /app
fi

# Start Next.js server
echo "[start.sh] Starting Next.js server on port ${PORT:-3000}..."
exec npm run start
