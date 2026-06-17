// Backend proxy qua Next.js Route Handler tại /api/*
// (xem app/api/[...path]/route.ts). Reliable cho cả prod + local.
export const API_BASE = "/api";

export type Script = {
  id: number;
  title: string;
  input_text: string;
  generated_text: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ScriptCreate = {
  title?: string;
  input_text?: string;
  generated_text?: string;
  status?: string;
};

export type ScriptUpdate = Partial<ScriptCreate>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type Profile = {
  content: string;
  updated_at: string;
  size_bytes: number;
  snapshot?: string;
};

export type SnapshotMeta = {
  name: string;
  size_bytes: number;
  created_at: string;
};

export type SnapshotFull = SnapshotMeta & { content: string };

export type CritiqueScore = {
  pass: boolean;
  reason: string;
};

export type Critique = {
  scores: Record<string, CritiqueScore>;
  overall_pass: boolean;
  summary: string;
};

export type VariantAttempt = {
  script: string;
  hints: string;
  word_count: number;
  critique: Critique;
  pass: boolean;
};

export type Variant = {
  variant_index: number;
  attempts: VariantAttempt[];
  chosen: VariantAttempt | null;
};

export type GenerateResponse = {
  input_text: string;
  samples_used: number;
  variants: Variant[];
};

export type TranscribeResponse = {
  text: string;
  duration_seconds: number | null;
  filename: string;
};

export type KeysStatus = {
  llm: boolean;
  stt: boolean;
  provider: string;
};

export const api = {
  listScripts: () => request<Script[]>("/scripts"),
  getScript: (id: number) => request<Script>(`/scripts/${id}`),
  createScript: (data: ScriptCreate) =>
    request<Script>("/scripts", { method: "POST", body: JSON.stringify(data) }),
  updateScript: (id: number, data: ScriptUpdate) =>
    request<Script>(`/scripts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteScript: (id: number) =>
    request<void>(`/scripts/${id}`, { method: "DELETE" }),

  getProfile: () => request<Profile>("/profile"),
  putProfile: (content: string) =>
    request<Profile>("/profile", { method: "PUT", body: JSON.stringify({ content }) }),
  listSnapshots: () => request<SnapshotMeta[]>("/profile/snapshots"),
  getSnapshot: (name: string) =>
    request<SnapshotFull>(`/profile/snapshots/${encodeURIComponent(name)}`),
  restoreSnapshot: (name: string) =>
    request<Profile>(`/profile/snapshots/${encodeURIComponent(name)}/restore`, {
      method: "POST",
    }),

  generateForScript: (id: number) =>
    request<GenerateResponse>(`/scripts/${id}/generate`, { method: "POST" }),
  keysStatus: () => request<KeysStatus>("/keys/status"),

  // Upload audio cho Whisper. Trả về text transcribed.
  transcribe: async (blob: Blob, filename = "recording.webm"): Promise<TranscribeResponse> => {
    const form = new FormData();
    form.append("file", blob, filename);
    const res = await fetch(`${API_BASE}/transcribe`, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
    }
    return res.json();
  },
};
