import json
from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..ai import parse_reply, stream_claude
from ..auth import get_current_user
from ..database import SessionLocal, get_db
from ..models import Message, Project, ProjectFile, User
from ..schemas import ChatRequest

router = APIRouter(prefix="/api/projects", tags=["chat"])


def _owned_project(project_id: int, user: User, db: Session) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _event(event: str, data: dict) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")


@router.post("/{project_id}/chat")
def chat(
    project_id: int,
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    project = _owned_project(project_id, current_user, db)

    history = [
        {"role": m.role, "content": m.content}
        for m in sorted(project.messages, key=lambda x: (x.created_at, x.id))
    ]
    existing_files = {f.path: f.content for f in project.files}

    user_msg = Message(project_id=project.id, role="user", content=payload.message)
    db.add(user_msg)
    db.commit()

    project_id_local = project.id
    user_message_text = payload.message

    def generator() -> Iterator[bytes]:
        buffer_parts: list[str] = []
        try:
            yield _event("start", {"project_id": project_id_local})
            for chunk in stream_claude(user_message_text, history, existing_files):
                buffer_parts.append(chunk)
                yield _event("delta", {"text": chunk})
        except Exception as exc:  # noqa: BLE001
            yield _event("error", {"message": str(exc)})
            return

        full = "".join(buffer_parts)
        parsed = parse_reply(full)

        new_db = SessionLocal()
        try:
            assistant_msg = Message(
                project_id=project_id_local,
                role="assistant",
                content=parsed.chat_text or full,
            )
            new_db.add(assistant_msg)

            saved_files: list[dict[str, str]] = []
            for path, content in parsed.files.items():
                existing = (
                    new_db.query(ProjectFile)
                    .filter(ProjectFile.project_id == project_id_local, ProjectFile.path == path)
                    .first()
                )
                if existing:
                    existing.content = content
                else:
                    new_db.add(ProjectFile(project_id=project_id_local, path=path, content=content))
                saved_files.append({"path": path})

            new_db.commit()
        finally:
            new_db.close()

        yield _event(
            "done",
            {
                "chat_text": parsed.chat_text,
                "files": saved_files,
            },
        )

    return StreamingResponse(generator(), media_type="text/event-stream")
