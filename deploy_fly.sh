#!/usr/bin/env bash
# Deploy backend + frontend lên Fly.io.
# Lần đầu chạy: cần `fly auth login` trước (em sẽ guide).

set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

BACKEND_APP="tiktok-cdt-backend"
FRONTEND_APP="tiktok-cdt"

require_auth() {
  if ! fly auth whoami > /dev/null 2>&1; then
    echo "Chưa login Fly.io. Chạy: fly auth signup  (hoặc fly auth login)"
    exit 1
  fi
}

deploy_backend() {
  echo "=== Backend ==="
  cd "$ROOT/backend"

  # Tạo app nếu chưa có
  if ! fly apps list 2>/dev/null | grep -q "^$BACKEND_APP\b"; then
    echo "→ Tạo app $BACKEND_APP..."
    fly apps create "$BACKEND_APP" --org personal
  fi

  # Tạo volume nếu chưa có
  if ! fly volumes list -a "$BACKEND_APP" 2>/dev/null | grep -q "tiktok_data"; then
    echo "→ Tạo volume tiktok_data (1GB)..."
    fly volumes create tiktok_data --region sin --size 1 -a "$BACKEND_APP" --yes
  fi

  # Set secret GROQ_API_KEY từ .env local
  if [ -f "$ROOT/backend/.env" ]; then
    GROQ_KEY=$(grep '^GROQ_API_KEY=' "$ROOT/backend/.env" | cut -d'=' -f2-)
    if [ -n "$GROQ_KEY" ] && [ "$GROQ_KEY" != "gsk_paste_key_thật_vào_đây" ]; then
      echo "→ Set GROQ_API_KEY (từ .env local)..."
      fly secrets set GROQ_API_KEY="$GROQ_KEY" -a "$BACKEND_APP" --stage
    fi
  fi

  echo "→ Deploy backend..."
  fly deploy -a "$BACKEND_APP" --remote-only
  cd "$ROOT"
}

deploy_frontend() {
  echo "=== Frontend ==="
  cd "$ROOT/frontend"

  if ! fly apps list 2>/dev/null | grep -q "^$FRONTEND_APP\b"; then
    echo "→ Tạo app $FRONTEND_APP..."
    fly apps create "$FRONTEND_APP" --org personal
  fi

  echo "→ Deploy frontend..."
  fly deploy -a "$FRONTEND_APP" --remote-only
  cd "$ROOT"
}

require_auth
deploy_backend
deploy_frontend

echo ""
echo "========================================"
echo "  Deploy xong"
echo "  Backend:  https://$BACKEND_APP.fly.dev"
echo "  Frontend: https://$FRONTEND_APP.fly.dev  ← share URL này"
echo "========================================"
