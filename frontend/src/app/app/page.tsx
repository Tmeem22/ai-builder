"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { api, type Project } from "@/lib/api";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setProjects(await api.listProjects());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const p = await api.createProject(name.trim());
      router.push(`/app/project?id=${p.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCreating(false);
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    await api.deleteProject(id);
    refresh();
  }

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Your projects</h1>
      </div>

      <form
        onSubmit={onCreate}
        className="flex items-center gap-2 rounded-xl border border-border bg-panel p-4 mb-8"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name (e.g. Portfolio site)"
          className="flex-1 bg-panel2 border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="flex items-center gap-1 px-4 py-2 rounded-md bg-accent hover:bg-accent/90 text-white font-medium disabled:opacity-60"
        >
          <Plus className="w-4 h-4" />
          {creating ? "Creating…" : "Create"}
        </button>
      </form>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted">
          You don&apos;t have any projects yet. Create one above to start chatting with AI.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {projects.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-border bg-panel hover:border-accent transition-colors"
            >
              <div className="p-4 flex items-start justify-between gap-3">
                <Link href={`/app/project?id=${p.id}`} className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted mt-1">
                    Updated {new Date(p.updated_at).toLocaleString()}
                  </div>
                </Link>
                <button
                  onClick={() => onDelete(p.id)}
                  className="text-muted hover:text-red-400 p-1"
                  title="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
