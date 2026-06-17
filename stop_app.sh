#!/usr/bin/env bash
# Tắt toàn bộ: backend + frontend + tunnel
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

BACKEND_PORT=8001
FRONTEND_PORT=3000

kill_port() {
  local port="$1"
  local name="$2"
  local pids
  pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [ -z "$pids" ]; then
    echo "✓ $name (port $port) — không chạy"
    return
  fi
  echo "→ Stop $name (port $port, PID $pids)..."
  echo "$pids" | xargs kill 2>/dev/null || true
  sleep 1
  # Force nếu vẫn còn
  pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
}

kill_tunnel() {
  local pids
  pids=$(pgrep -f "localtunnel.*--port" 2>/dev/null || true)
  pids="$pids $(pgrep -f "cloudflared tunnel" 2>/dev/null || true)"
  pids=$(echo "$pids" | tr -s ' ' '\n' | grep -v '^$' || true)
  if [ -z "$pids" ]; then
    echo "✓ Tunnel — không chạy"
    return
  fi
  echo "→ Stop tunnel (PID $(echo $pids | tr '\n' ' '))..."
  echo "$pids" | xargs kill 2>/dev/null || true
  sleep 1
  pids=$(pgrep -f "localtunnel.*--port" 2>/dev/null || true)
  pids="$pids $(pgrep -f "cloudflared tunnel" 2>/dev/null || true)"
  pids=$(echo "$pids" | tr -s ' ' '\n' | grep -v '^$' || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
}

kill_port "$BACKEND_PORT" "Backend"
kill_port "$FRONTEND_PORT" "Frontend"
kill_tunnel

echo ""
echo "✓ App đã tắt hết."
