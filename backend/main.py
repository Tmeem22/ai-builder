"""Convenience entrypoint: `uvicorn main:app` works at the project root."""
from app.main import app

__all__ = ["app"]
