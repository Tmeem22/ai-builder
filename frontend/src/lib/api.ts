export const API_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000";

const TOKEN_KEY = "ai-builder.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export type User = { id: number; email: string; created_at: string };
export type Project = {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};
export type ProjectFile = {
  id: number;
  path: string;
  content: string;
  updated_at: string;
};
export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const detail =
      (data && typeof data === "object" && "detail" in data && (data as { detail: unknown }).detail) ||
      res.statusText;
    throw new ApiError(typeof detail === "string" ? detail : JSON.stringify(detail), res.status);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  async register(email: string, password: string) {
    return request<{ access_token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  async login(email: string, password: string) {
    const form = new FormData();
    form.append("username", email);
    form.append("password", password);
    return request<{ access_token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: form,
    });
  },
  async me() {
    return request<User>("/api/auth/me");
  },
  async listProjects() {
    return request<Project[]>("/api/projects");
  },
  async createProject(name: string, description = "") {
    return request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
  },
  async deleteProject(id: number) {
    return request<null>(`/api/projects/${id}`, { method: "DELETE" });
  },
  async getProject(id: number) {
    return request<Project>(`/api/projects/${id}`);
  },
  async listFiles(id: number) {
    return request<ProjectFile[]>(`/api/projects/${id}/files`);
  },
  async listMessages(id: number) {
    return request<ChatMessage[]>(`/api/projects/${id}/messages`);
  },
};

export { ApiError };

export type ChatStreamEvent =
  | { event: "start"; data: { project_id: number } }
  | { event: "delta"; data: { text: string } }
  | { event: "done"; data: { chat_text: string; files: { path: string }[] } }
  | { event: "error"; data: { message: string } };

export async function streamChat(
  projectId: number,
  message: string,
  onEvent: (e: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/projects/${projectId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new ApiError(text || res.statusText, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const parsed = parseSseBlock(raw);
      if (parsed) onEvent(parsed);
    }
  }
}

function parseSseBlock(block: string): ChatStreamEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    const data = JSON.parse(dataLines.join("\n"));
    return { event, data } as ChatStreamEvent;
  } catch {
    return null;
  }
}
