"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Script, type KeysStatus } from "./lib/api";
import { useAudioRecorder, pickExtension } from "./lib/recorder";

export default function HomePage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [keys, setKeys] = useState<KeysStatus | null>(null);

  const [title, setTitle] = useState("");
  const [inputText, setInputText] = useState("");
  const [saving, setSaving] = useState(false);

  // Recorder
  const rec = useAudioRecorder();
  const [transcribing, setTranscribing] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [data, k] = await Promise.all([api.listScripts(), api.keysStatus().catch(() => null)]);
      setScripts(data);
      setKeys(k);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() && !title.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await api.createScript({ title: title.trim(), input_text: inputText.trim() });
      setTitle("");
      setInputText("");
      rec.reset();
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Xoá kịch bản này?")) return;
    try {
      await api.deleteScript(id);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function useRecording() {
    if (!rec.blob) return;
    setTranscribing(true);
    setErr(null);
    try {
      const ext = pickExtension(rec.blob.type || "");
      const result = await api.transcribe(rec.blob, `recording.${ext}`);
      setInputText((prev) => (prev ? `${prev}\n\n${result.text}` : result.text));
      rec.reset();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setTranscribing(false);
    }
  }

  function fmtSec(s: number) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
      <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold leading-tight">
            Kịch bản TikTok — Cai Duy Thái
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Mô tả hoặc ghi âm → AI sinh kịch bản bám giọng em.
          </p>
        </div>
        <Link
          href="/profile"
          className="self-start sm:self-auto rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 inline-flex items-center"
        >
          Hồ sơ phong cách →
        </Link>
      </header>

      {keys && (!keys.llm || !keys.stt) && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
          <div className="font-medium mb-1">⚠️ Thiếu API key ({keys.provider})</div>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            {!keys.llm && <li>Chưa sinh kịch bản được — cần GROQ_API_KEY.</li>}
            {!keys.stt && <li>Chưa ghi âm được — cần GROQ_API_KEY (Whisper Large v3 free).</li>}
          </ul>
          <div className="text-xs mt-2">
            Edit <code className="font-mono bg-white px-1 rounded">backend/.env</code> rồi restart backend.
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-neutral-200 p-4 sm:p-5 mb-8 sm:mb-10">
        <h2 className="font-medium mb-3">Tạo mô tả video mới</h2>
        <form onSubmit={onSave} className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề ngắn (tuỳ chọn)"
            className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Mô tả video: video có gì, em muốn nói gì, thông điệp..."
            rows={6}
            className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />

          {/* Recorder bar */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            {rec.state === "idle" && (
              <button
                type="button"
                onClick={rec.start}
                disabled={keys ? !keys.stt : false}
                className="w-full sm:w-auto rounded-lg bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                🎤 Ghi âm thay vì viết
              </button>
            )}
            {rec.state === "requesting" && (
              <div className="text-sm text-neutral-600">Đang xin quyền micro…</div>
            )}
            {rec.state === "recording" && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-block w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse" />
                  <span className="font-mono">{fmtSec(rec.seconds)}</span>
                  <span className="text-neutral-500">đang ghi…</span>
                </div>
                <button
                  type="button"
                  onClick={rec.stop}
                  className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-medium"
                >
                  ■ Dừng
                </button>
              </div>
            )}
            {rec.state === "stopped" && rec.blob && (
              <div className="space-y-2">
                <div className="text-xs text-neutral-600">
                  Ghi {fmtSec(rec.seconds)} · {(rec.blob.size / 1024).toFixed(0)} KB
                </div>
                <audio
                  controls
                  src={URL.createObjectURL(rec.blob)}
                  className="w-full"
                />
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={useRecording}
                    disabled={transcribing}
                    className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {transcribing ? "Đang chuyển text…" : "Chuyển thành text"}
                  </button>
                  <button
                    type="button"
                    onClick={rec.reset}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
                  >
                    Ghi lại
                  </button>
                </div>
              </div>
            )}
            {rec.err && <div className="text-xs text-red-600 mt-2 break-words">{rec.err}</div>}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium disabled:opacity-50 w-full sm:w-auto"
            >
              {saving ? "Đang lưu…" : "Lưu mô tả"}
            </button>
            {err && <span className="text-sm text-red-600 break-words">{err}</span>}
          </div>
        </form>
      </section>

      <section>
        <h2 className="font-medium mb-3">Đã lưu ({scripts.length})</h2>
        {loading ? (
          <p className="text-sm text-neutral-500">Đang tải…</p>
        ) : scripts.length === 0 ? (
          <p className="text-sm text-neutral-500">Chưa có kịch bản nào.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
            {scripts.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link
                  href={`/scripts/${s.id}`}
                  className="flex-1 min-w-0 group py-1"
                >
                  <div className="text-sm font-medium truncate group-hover:underline">
                    {s.title || "(không có tiêu đề)"}
                  </div>
                  <div className="text-xs text-neutral-500 truncate mt-0.5">
                    {s.input_text || "—"}
                  </div>
                </Link>
                <button
                  onClick={() => onDelete(s.id)}
                  className="text-sm text-red-600 hover:underline shrink-0 px-2"
                >
                  Xoá
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
