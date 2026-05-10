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

The backend is designed for Fly.io (`pyproject.toml` + auto-generated `Dockerfile`).
The frontend builds to a static Next.js app and can be deployed anywhere that
serves Node 18+ runtimes, or exported via `next build`.

`NEXT_PUBLIC_API_URL` must point to your deployed backend URL.

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
