// Client fetch trực tiếp backend (CORS đã setup ở backend).
// Detect runtime: production trên Render → URL Render; local → 127.0.0.1.
function detectBackend(): string {
  if (typeof window === "undefined") {
    return process.env.BACKEND_URL || "http://127.0.0.1:8001";
  }
  const host = window.location.hostname;
  if (host.includes("onrender.com") || host.includes("vercel.app")) {
    return "https://tiktok-cdt-backend.onrender.com";
  }
  return "http://127.0.0.1:8001";
}

export const API_BASE = detectBackend();

export type StyleTone =
  | "default"
  | "humor"
  | "deep"
  | "storytelling"
  | "energetic"
  | "selfmock";

export const STYLE_TONE_OPTIONS: { value: StyleTone; label: string; hint: string }[] = [
  { value: "default", label: "Mặc định (gần gũi 70/20/10)", hint: "Cân bằng, dùng cho hầu hết video" },
  { value: "humor", label: "Hài nhẹ", hint: "50% gần gũi + 40% hài + 10% sâu" },
  { value: "deep", label: "Sâu sắc", hint: "40% gần + 10% hài + 50% sâu, chậm, ngẫm" },
  { value: "storytelling", label: "Kể chuyện", hint: "'Hôm nọ...', chi tiết hoá tình huống" },
  { value: "energetic", label: "Sôi nổi, nhấn mạnh", hint: "Câu ngắn dồn dập, ngữ khí mạnh" },
  { value: "selfmock", label: "Tự trào đậm", hint: "Chê mình rõ, thừa nhận cái dở" },
];

export type Script = {
  id: number;
  title: string;
  input_text: string;
  generated_text: string;
  status: string;
  duration_seconds: number;
  style_tone: string;
  context_qa: string;
  created_at: string;
  updated_at: string;
};

export type ScriptCreate = {
  title?: string;
  input_text?: string;
  generated_text?: string;
  status?: string;
  duration_seconds?: number;
  style_tone?: string;
  context_qa?: string;
};

export type ScriptUpdate = Partial<ScriptCreate>;

export type SuggestQuestionsResponse = {
  questions: string[];
};

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
  duration_seconds?: number;
  style_tone?: string;
  context_qa_used?: boolean;
  word_range?: { min: number; target: number; max: number };
  provider?: string;
  model?: string;
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
  suggestQuestionsForScript: (id: number) =>
    request<SuggestQuestionsResponse>(`/scripts/${id}/suggest_questions`, { method: "POST" }),
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
