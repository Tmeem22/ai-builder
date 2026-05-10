"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, FileCode2, Send } from "lucide-react";
import {
  api,
  streamChat,
  type ChatMessage,
  type Project,
  type ProjectFile,
} from "@/lib/api";

type LocalMsg = { id: string; role: "user" | "assistant"; content: string; pending?: boolean };

export default function ProjectPage({ params }: { params: { id: string } }) {
  const projectId = Number(params.id);
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const refreshAll = useCallback(async () => {
    try {
      const [p, msgs, fls] = await Promise.all([
        api.getProject(projectId),
        api.listMessages(projectId),
        api.listFiles(projectId),
      ]);
      setProject(p);
      setMessages(
        msgs.map((m: ChatMessage) => ({
          id: `db-${m.id}`,
          role: m.role,
          content: m.content,
        })),
      );
      setFiles(fls);
      if (!activeFile && fls.length > 0) setActiveFile(fls[0].path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId, activeFile]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const indexHtml = useMemo(() => files.find((f) => f.path === "index.html"), [files]);
  const previewSrcDoc = indexHtml?.content || buildPlaceholderPreview(files);
  const activeFileObj = files.find((f) => f.path === activeFile) || null;

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);
    setError(null);

    const userId = `tmp-u-${Date.now()}`;
    const assistantId = `tmp-a-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: userId, role: "user", content: text },
      { id: assistantId, role: "assistant", content: "", pending: true },
    ]);

    try {
      await streamChat(projectId, text, (ev) => {
        if (ev.event === "delta") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + ev.data.text } : m,
            ),
          );
        } else if (ev.event === "done") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: ev.data.chat_text || m.content, pending: false }
                : m,
            ),
          );
          api.listFiles(projectId).then((fls) => {
            setFiles(fls);
            const touched = ev.data.files?.[0]?.path;
            if (touched) {
              setActiveFile(touched);
            } else if (!activeFile && fls.length > 0) {
              setActiveFile(fls[0].path);
            }
          });
        } else if (ev.event === "error") {
          setError(ev.data.message);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `⚠ ${ev.data.message}`, pending: false }
                : m,
            ),
          );
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `⚠ ${e instanceof Error ? e.message : String(e)}`, pending: false }
            : m,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted">Loading project…</div>
    );
  }

  return (
    <main className="flex-1 grid grid-cols-1 md:grid-cols-[420px,1fr] min-h-[calc(100vh-57px)]">
      {/* Chat pane */}
      <section className="flex flex-col border-r border-border min-h-0">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Link href="/app" className="text-muted hover:text-text" title="Back">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h2 className="font-medium truncate">{project?.name}</h2>
        </div>

        <div ref={chatScrollRef} className="flex-1 overflow-y-auto scrollbar p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-sm text-muted">
              Describe what you want to build. The AI will generate the files and preview them on
              the right.
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
              <div
                className={
                  "inline-block max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words " +
                  (m.role === "user"
                    ? "bg-accent text-white"
                    : "bg-panel border border-border text-text")
                }
              >
                {m.content}
                {m.pending && (
                  <span className="ml-2 inline-flex gap-1 align-middle">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="px-4 pb-2 text-xs text-red-400 break-words">{error}</div>
        )}

        <form onSubmit={onSend} className="p-3 border-t border-border flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Describe a website, file, or change…"
            rows={2}
            className="flex-1 resize-none bg-panel2 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="h-10 px-3 rounded-md bg-accent hover:bg-accent/90 text-white disabled:opacity-60 flex items-center gap-1"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </section>

      {/* Preview/code pane */}
      <section className="flex flex-col min-h-0">
        <div className="px-4 py-2 border-b border-border flex items-center gap-1">
          <button
            onClick={() => setTab("preview")}
            className={
              "px-3 py-1.5 rounded-md text-sm flex items-center gap-1 " +
              (tab === "preview" ? "bg-panel border border-border" : "text-muted hover:text-text")
            }
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button
            onClick={() => setTab("code")}
            className={
              "px-3 py-1.5 rounded-md text-sm flex items-center gap-1 " +
              (tab === "code" ? "bg-panel border border-border" : "text-muted hover:text-text")
            }
          >
            <FileCode2 className="w-4 h-4" /> Code ({files.length})
          </button>
        </div>

        {tab === "preview" ? (
          <div className="flex-1 bg-white">
            <iframe
              key={previewSrcDoc.length + ":" + (indexHtml?.updated_at || "")}
              title="preview"
              srcDoc={previewSrcDoc}
              className="w-full h-full"
              sandbox="allow-scripts allow-forms"
            />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-[220px,1fr] min-h-0">
            <aside className="border-r border-border overflow-y-auto scrollbar bg-panel/40">
              {files.length === 0 ? (
                <p className="p-3 text-sm text-muted">No files yet.</p>
              ) : (
                <ul className="py-2">
                  {files.map((f) => (
                    <li key={f.path}>
                      <button
                        onClick={() => setActiveFile(f.path)}
                        className={
                          "w-full text-left px-3 py-1.5 text-sm truncate " +
                          (activeFile === f.path
                            ? "bg-panel text-text"
                            : "text-muted hover:text-text hover:bg-panel/60")
                        }
                      >
                        {f.path}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
            <div className="overflow-auto scrollbar bg-bg">
              {activeFileObj ? (
                <pre className="text-xs font-mono p-4 whitespace-pre-wrap break-words">
                  {activeFileObj.content}
                </pre>
              ) : (
                <p className="p-4 text-muted text-sm">Select a file.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function buildPlaceholderPreview(files: ProjectFile[]): string {
  if (files.length === 0) {
    return `<!doctype html><html><body style="font-family: system-ui; padding: 32px; color:#555; background:#fff">
      <h2>Your preview will appear here</h2>
      <p>Send a message like <em>"Build a landing page for a coffee shop"</em> to generate files.</p>
    </body></html>`;
  }
  const list = files.map((f) => `<li><code>${escapeHtml(f.path)}</code></li>`).join("");
  return `<!doctype html><html><body style="font-family: system-ui; padding: 32px; background:#fff; color:#333">
    <h2>Generated files</h2>
    <p>This project has no <code>index.html</code> to preview. Switch to <strong>Code</strong> to inspect them.</p>
    <ul>${list}</ul>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
