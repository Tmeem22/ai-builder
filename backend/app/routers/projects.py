from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Project, ProjectFile, Message, User
from ..schemas import (
    MessageOut,
    ProjectCreate,
    ProjectFileOut,
    ProjectOut,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _get_owned_project(project_id: int, user: User, db: Session) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("", response_model=list[ProjectOut])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectOut]:
    projects = (
        db.query(Project)
        .filter(Project.user_id == current_user.id)
        .order_by(Project.updated_at.desc())
        .all()
    )
    return [ProjectOut.model_validate(p) for p in projects]


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectOut:
    project = Project(
        user_id=current_user.id,
        name=payload.name.strip(),
        description=payload.description.strip(),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectOut:
    return ProjectOut.model_validate(_get_owned_project(project_id, current_user, db))


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    project = _get_owned_project(project_id, current_user, db)
    db.delete(project)
    db.commit()


@router.get("/{project_id}/files", response_model=list[ProjectFileOut])
def list_files(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectFileOut]:
    project = _get_owned_project(project_id, current_user, db)
    files = (
        db.query(ProjectFile)
        .filter(ProjectFile.project_id == project.id)
        .order_by(ProjectFile.path.asc())
        .all()
    )
    return [ProjectFileOut.model_validate(f) for f in files]


@router.get("/{project_id}/messages", response_model=list[MessageOut])
def list_messages(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MessageOut]:
    project = _get_owned_project(project_id, current_user, db)
    msgs = (
        db.query(Message)
        .filter(Message.project_id == project.id)
        .order_by(Message.created_at.asc(), Message.id.asc())
        .all()
    )
    return [MessageOut.model_validate(m) for m in msgs]
