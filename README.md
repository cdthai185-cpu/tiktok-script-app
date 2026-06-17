# TikTok Script App — Cai Duy Thái

Web app viết kịch bản TikTok bằng AI, bám giọng văn riêng.

## Stack
- Backend: FastAPI + SQLite + Groq (Llama 3.3 70B + Whisper Large v3)
- Frontend: Next.js 16 + Tailwind v4
- Deploy: Render (free tier)

## Local dev
```
./start_app.sh           # local, 110MB
./start_app.sh --public  # local + Cloudflare tunnel
./stop_app.sh
./status_app.sh
```

## Production deploy
Code đã sẵn `render.yaml` Blueprint. Login Render, Apply Blueprint, set `GROQ_API_KEY` secret cho backend.
