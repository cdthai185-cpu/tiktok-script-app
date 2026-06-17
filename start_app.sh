#!/usr/bin/env bash
# Khởi động app.
#   ./start_app.sh           — chỉ local (110MB, mở localhost:3000)
#   ./start_app.sh --public  — bật cả localtunnel để dùng từ điện thoại 4G
#                              URL CỐ ĐỊNH: https://tiktok-thaicai.loca.lt
#   ./start_app.sh --dev     — chế độ code (hot-reload, ~500MB)

set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"
mkdir -p logs

MODE_PUBLIC=0
MODE_DEV=0
for arg in "$@"; do
  case "$arg" in
    --public) MODE_PUBLIC=1 ;;
    --dev)    MODE_DEV=1 ;;
    *) echo "Unknown flag: $arg"; exit 2 ;;
  esac
done

BACKEND_PORT=8001
FRONTEND_PORT=3000
TUNNEL_SUBDOMAIN="tiktok-thaicai"

BACKEND_LOG="$ROOT/logs/backend.log"
FRONTEND_LOG="$ROOT/logs/frontend.log"
TUNNEL_LOG="$ROOT/logs/tunnel.log"

port_busy() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

start_backend() {
  if port_busy "$BACKEND_PORT"; then
    echo "✓ Backend đã chạy trên port $BACKEND_PORT (skip)"
    return
  fi
  echo "→ Khởi động backend (port $BACKEND_PORT)..."
  cd "$ROOT/backend"
  nohup .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" \
    > "$BACKEND_LOG" 2>&1 &
  cd "$ROOT"

  for _ in {1..30}; do
    if curl -sf "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; then
      echo "  ✓ Backend ready"
      return
    fi
    sleep 1
  done
  echo "  ✗ Backend không sẵn sàng. Xem: $BACKEND_LOG"
  exit 1
}

start_frontend() {
  if port_busy "$FRONTEND_PORT"; then
    echo "✓ Frontend đã chạy trên port $FRONTEND_PORT (skip)"
    return
  fi

  cd "$ROOT/frontend"

  if [ "$MODE_DEV" = "1" ]; then
    echo "→ Frontend dev mode (hot-reload, ~500MB)..."
    nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
  else
    if [ ! -d ".next" ]; then
      echo "→ Lần đầu chạy production, build trước..."
      npm run build > "$FRONTEND_LOG" 2>&1
    fi
    echo "→ Frontend production mode (~80MB)..."
    nohup npm run start -- --hostname 127.0.0.1 --port "$FRONTEND_PORT" \
      > "$FRONTEND_LOG" 2>&1 &
  fi

  cd "$ROOT"

  for _ in {1..60}; do
    if curl -sf "http://127.0.0.1:$FRONTEND_PORT/" >/dev/null 2>&1; then
      echo "  ✓ Frontend ready"
      return
    fi
    sleep 1
  done
  echo "  ✗ Frontend không sẵn sàng. Xem: $FRONTEND_LOG"
  exit 1
}

start_tunnel() {
  if pgrep -f "localtunnel.*--port $FRONTEND_PORT" >/dev/null 2>&1; then
    echo "✓ localtunnel đã chạy"
    return
  fi
  echo "→ Khởi động localtunnel (subdomain: $TUNNEL_SUBDOMAIN)..."
  : > "$TUNNEL_LOG"
  nohup npx -y localtunnel --port "$FRONTEND_PORT" --subdomain "$TUNNEL_SUBDOMAIN" \
    > "$TUNNEL_LOG" 2>&1 &

  for _ in {1..40}; do
    URL=$(grep -oE "https://[a-z0-9-]+\.loca\.lt" "$TUNNEL_LOG" 2>/dev/null | head -1)
    if [ -n "$URL" ]; then
      echo "  ✓ Tunnel ready"
      echo "$URL" > "$ROOT/logs/last_url.txt"
      return
    fi
    sleep 1
  done
  echo "  ✗ Tunnel không lấy được URL. Xem: $TUNNEL_LOG"
  exit 1
}

start_backend
start_frontend
[ "$MODE_PUBLIC" = "1" ] && start_tunnel

URL=""
[ "$MODE_PUBLIC" = "1" ] && URL=$(cat "$ROOT/logs/last_url.txt" 2>/dev/null || echo "")
PUBLIC_IP=""
if [ -n "$URL" ]; then
  PUBLIC_IP=$(curl -s --max-time 3 ipinfo.io/ip 2>/dev/null || echo "")
fi

echo ""
echo "========================================"
echo "  App sẵn sàng"
[ "$MODE_DEV" = "1" ] && echo "  Mode: DEV (~500MB)"
[ "$MODE_DEV" = "0" ] && echo "  Mode: PRODUCTION (~160MB)"
echo "  Local:  http://localhost:$FRONTEND_PORT"
if [ -n "$URL" ]; then
  echo "  Public: $URL  (CỐ ĐỊNH)"
  if [ -n "$PUBLIC_IP" ]; then
    echo ""
    echo "  ⚠️  Lần đầu vào URL từ thiết bị mới (vd điện thoại):"
    echo "     trang sẽ hỏi 'tunnel password' = IP public máy này:"
    echo "     $PUBLIC_IP"
    echo "     Nhập → Click to Submit → cookie nhớ, lần sau không hỏi nữa."
  fi
else
  echo "  Public: TẮT  (chạy với --public để bật)"
fi
echo "----------------------------------------"
echo "  Status: ./status_app.sh"
echo "  Stop:   ./stop_app.sh"
echo "========================================"
