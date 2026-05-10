# AI Builder — Backend (FastAPI)

JWT-authenticated API that streams Claude responses, parses `<file>` blocks,
and persists projects, files, and chat history per user.

## Quick start

```bash
cd backend
uv sync
cp .env.example .env   # then edit ANTHROPIC_API_KEY + JWT_SECRET
uv run uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Endpoints

- `POST /api/auth/register` — `{ email, password }` → `{ access_token, user }`
- `POST /api/auth/login` — OAuth2 form (`username`, `password`) → `{ access_token, user }`
- `GET  /api/auth/me`
- `GET  /api/projects`
- `POST /api/projects` — `{ name, description }`
- `GET  /api/projects/{id}`
- `DELETE /api/projects/{id}`
- `GET  /api/projects/{id}/files`
- `GET  /api/projects/{id}/messages`
- `POST /api/projects/{id}/chat` — `{ message }` → Server-Sent-Events stream

### Chat SSE events

| event   | data                                                |
| ------- | --------------------------------------------------- |
| `start` | `{ "project_id": 1 }`                               |
| `delta` | `{ "text": "..." }` — incremental Claude text       |
| `done`  | `{ "chat_text": "...", "files": [{"path": "..."}] }`|
| `error` | `{ "message": "..." }`                              |
