#!/usr/bin/env bash
# Xem nhanh trạng thái 3 server + URL public hiện tại
cd "$(dirname "$0")"

check() {
  local port="$1"
  local name="$2"
  local pid
  pid=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1)
  if [ -n "$pid" ]; then
    echo "● $name (port $port) — chạy, PID $pid"
  else
    echo "○ $name (port $port) — TẮT"
  fi
}

check 8001 "Backend"
check 3000 "Frontend"

t_pid=$(pgrep -f "localtunnel.*--port" 2>/dev/null | head -1)
[ -z "$t_pid" ] && t_pid=$(pgrep -f "cloudflared tunnel" 2>/dev/null | head -1)
if [ -n "$t_pid" ]; then
  echo "● Tunnel — chạy, PID $t_pid"
else
  echo "○ Tunnel — TẮT"
fi

URL=$(grep -oE "https://[a-z0-9-]+\.loca\.lt|https://[a-z0-9-]+\.trycloudflare\.com" logs/tunnel.log 2>/dev/null | tail -1)
if [ -n "$URL" ] && [ -n "$t_pid" ]; then
  echo ""
  echo "URL public: $URL"
fi
