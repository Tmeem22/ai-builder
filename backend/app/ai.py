"""Integration with Anthropic Claude.

The model is instructed to return file changes inside structured XML-like
blocks, e.g.:

    <file path="src/index.html">
    <!doctype html> ...
    </file>

Any prose outside the file blocks is treated as the assistant's chat reply.
"""
from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import dataclass

from anthropic import Anthropic

from .config import settings

SYSTEM_PROMPT = """You are AI Builder, an expert full-stack engineer that helps users build websites, files, and apps.

Your responsibilities for every reply:
1. Think briefly about what the user wants and what files need to change.
2. Emit any new or updated files using THIS EXACT FORMAT — one block per file:

<file path="relative/path/to/file.ext">
...full file content goes here...
</file>

Rules:
- Always include the FULL content of every file you write — never use diffs, placeholders like "// ... rest unchanged", or partial snippets.
- Paths must be relative (no leading slash). Use forward slashes.
- For a single-page website prefer a single `index.html` at the root with inline CSS/JS unless the user asks otherwise.
- Outside of <file> blocks you may write a short, friendly chat reply (in the same language the user spoke).
- Do NOT wrap <file> blocks in markdown code fences.
- Never invent files unrelated to the request.

If the user only asks a question, you may answer without emitting any <file> blocks.
"""

FILE_BLOCK_RE = re.compile(
    r'<file\s+path="(?P<path>[^"]+)"\s*>\s*\n?(?P<content>.*?)\n?</file>',
    re.DOTALL,
)


@dataclass
class ParsedReply:
    chat_text: str
    files: dict[str, str]


def parse_reply(raw: str) -> ParsedReply:
    files: dict[str, str] = {}
    for m in FILE_BLOCK_RE.finditer(raw):
        path = m.group("path").strip().lstrip("/")
        if not path:
            continue
        files[path] = m.group("content")
    chat_text = FILE_BLOCK_RE.sub("", raw).strip()
    return ParsedReply(chat_text=chat_text, files=files)


_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        if not settings.anthropic_api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not configured. Set it in the backend environment.",
            )
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


def stream_claude(
    user_message: str,
    history: list[dict[str, str]],
    existing_files: dict[str, str],
) -> Iterator[str]:
    """Stream raw text chunks from Claude given the conversation history."""
    client = _get_client()

    context_blocks: list[str] = []
    if existing_files:
        listing = "\n".join(
            f"<file path=\"{p}\">\n{c}\n</file>"
            for p, c in existing_files.items()
        )
        context_blocks.append(
            "Current project files (you may modify or replace any of them):\n" + listing
        )

    messages: list[dict[str, str]] = []
    for m in history:
        messages.append({"role": m["role"], "content": m["content"]})

    user_content = user_message
    if context_blocks:
        user_content = "\n\n".join(context_blocks) + "\n\n---\n\nUser request:\n" + user_message
    messages.append({"role": "user", "content": user_content})

    with client.messages.stream(
        model=settings.anthropic_model,
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield text
