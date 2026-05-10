# AI Builder

A full-stack AI app builder inspired by emergent.sh — chat with Claude to generate complete websites and files, preview them live, and keep all your projects per account.

- **Frontend**: Next.js 14 + Tailwind (App Router, TypeScript)
- **Backend**: FastAPI + SQLAlchemy + JWT auth
- **AI**: Anthropic Claude (streamed via Server-Sent Events)
- **Auth**: JWT only (email + password). No OAuth.

## Features

- Email/password signup & login, JWT-protected API
- Per-user projects with persistent file tree + chat history
- Real-time streaming chat with Claude
- Claude is instructed to emit `<file path="...">...</file>` blocks; the backend
  parses them and stores each file in the project
- Live HTML preview (`index.html` rendered in a sandboxed iframe)
- Browse generated files in a code tab

## Local development

### Backend

```bash
cd backend
uv sync
cp .env.example .env   # set ANTHROPIC_API_KEY and JWT_SECRET
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000 and create an account.

## Deployment

### Frontend

`next build` with `output: "export"` produces a static site in `frontend/out/` that you can host anywhere (CDN, S3, Cloudflare Pages, devinapps, etc.). Set `NEXT_PUBLIC_API_URL` to your deployed backend URL before building.

### Backend on Render (recommended)

A Render Blueprint (`render.yaml`) is included at the repo root.

1. Push this repo to GitHub.
2. Go to https://dashboard.render.com/blueprints → **New Blueprint Instance** → pick the repo.
3. Render reads `render.yaml`, builds the `backend/Dockerfile`, and creates a free Web Service.
4. After the first deploy, open the service in the Render dashboard and set `ANTHROPIC_API_KEY` (the blueprint marks it `sync: false`, i.e. you must provide it).
5. `JWT_SECRET` is auto-generated. `CORS_ORIGINS` defaults to `*` — tighten it to your frontend origin once you know the final URL.
6. Health check is at `/api/health`.

> SQLite lives at `/tmp/ai_builder.db` on Render Free — it resets on every deploy/restart. Add a paid disk in the dashboard or swap `DATABASE_URL` to Postgres for persistent data.

### Backend on Fly.io

A `fly.toml` is also included. After `flyctl auth login`:

```bash
cd backend
fly launch --copy-config --no-deploy
fly secrets set ANTHROPIC_API_KEY=... JWT_SECRET=$(openssl rand -hex 32)
fly deploy
```

## API

| Method | Path                              | Description                          |
| ------ | --------------------------------- | ------------------------------------ |
| POST   | `/api/auth/register`              | `{ email, password }` → JWT          |
| POST   | `/api/auth/login`                 | OAuth2 form → JWT                    |
| GET    | `/api/auth/me`                    | Current user                         |
| GET    | `/api/projects`                   | List projects                        |
| POST   | `/api/projects`                   | Create project                       |
| GET    | `/api/projects/{id}`              | Get project                          |
| DELETE | `/api/projects/{id}`              | Delete project                       |
| GET    | `/api/projects/{id}/files`        | List files                           |
| GET    | `/api/projects/{id}/messages`     | List messages                        |
| POST   | `/api/projects/{id}/chat`         | Stream Claude reply + persist files  |
