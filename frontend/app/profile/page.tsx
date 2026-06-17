"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Profile, type SnapshotMeta, type SnapshotFull } from "../lib/api";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [content, setContent] = useState("");
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [previewName, setPreviewName] = useState<string | null>(null);
  const [preview, setPreview] = useState<SnapshotFull | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const [p, snaps] = await Promise.all([api.getProfile(), api.listSnapshots()]);
      setProfile(p);
      setContent(p.content);
      setSnapshots(snaps);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function onSave() {
    if (!content) return;
    setSaving(true);
    setErr(null);
    try {
      const p = await api.putProfile(content);
      setProfile(p);
      setSavedAt(new Date().toLocaleTimeString());
      const snaps = await api.listSnapshots();
      setSnapshots(snaps);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function openPreview(name: string) {
    setPreviewName(name);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const snap = await api.getSnapshot(name);
      setPreview(snap);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewName(null);
    setPreview(null);
  }

  async function onRestore(name: string) {
    if (!confirm(`Khôi phục từ ${name}? Bản hiện tại sẽ được snapshot trước khi ghi đè.`)) return;
    setSaving(true);
    setErr(null);
    try {
      const p = await api.restoreSnapshot(name);
      setProfile(p);
      setContent(p.content);
      setSavedAt(new Date().toLocaleTimeString());
      const snaps = await api.listSnapshots();
      setSnapshots(snaps);
      closePreview();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const dirty = profile !== null && content !== profile.content;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Về trang chính</Link>
      <header className="mt-2 mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Hồ sơ phong cách</h1>
          <p className="text-sm text-neutral-500 mt-1">
            File này định nghĩa giọng văn. Mỗi lần lưu tự tạo snapshot bản cũ — không mất dữ liệu.
          </p>
        </div>
        {profile && (
          <div className="text-xs text-neutral-500 sm:text-right shrink-0">
            {profile.size_bytes} bytes · cập nhật {new Date(profile.updated_at).toLocaleString()}
          </div>
        )}
      </header>

      {loading ? (
        <p className="text-sm text-neutral-500">Đang tải…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* editor */}
          <section>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              rows={20}
              className="w-full rounded-xl border border-neutral-300 px-3 sm:px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-neutral-900 min-h-[60vh]"
            />
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                onClick={onSave}
                disabled={saving || !dirty}
                className="rounded-lg bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium disabled:opacity-40 w-full sm:w-auto"
              >
                {saving ? "Đang lưu…" : dirty ? "Lưu thay đổi" : "Chưa có thay đổi"}
              </button>
              {savedAt && <span className="text-xs text-neutral-500">Lưu lúc {savedAt}</span>}
              {dirty && <span className="text-xs text-amber-600">● có thay đổi chưa lưu</span>}
              {err && <span className="text-sm text-red-600 break-words">{err}</span>}
            </div>
          </section>

          {/* snapshots sidebar */}
          <aside className="rounded-xl border border-neutral-200 p-4">
            <h2 className="font-medium text-sm mb-3">Snapshot ({snapshots.length})</h2>
            {snapshots.length === 0 ? (
              <p className="text-xs text-neutral-500">Chưa có. Snapshot tạo tự động khi anh lưu.</p>
            ) : (
              <ul className="space-y-1.5 max-h-[40vh] lg:max-h-[60vh] overflow-auto">
                {snapshots.map((s) => (
                  <li key={s.name}>
                    <button
                      onClick={() => openPreview(s.name)}
                      className="w-full text-left rounded-md px-2 py-2 hover:bg-neutral-100 min-h-0"
                    >
                      <div className="text-xs font-mono truncate">{s.name}</div>
                      <div className="text-[11px] text-neutral-500">
                        {new Date(s.created_at).toLocaleString()} · {s.size_bytes}b
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}

      {/* preview modal */}
      {previewName && (
        <div
          onClick={closePreview}
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-2xl sm:rounded-2xl max-w-3xl w-full max-h-[90vh] sm:max-h-[80vh] flex flex-col"
          >
            <div className="px-4 sm:px-5 py-3 border-b border-neutral-200 flex items-center justify-between gap-3">
              <div className="font-mono text-xs sm:text-sm truncate">{previewName}</div>
              <button onClick={closePreview} className="text-sm text-neutral-500 hover:text-neutral-900 px-3">
                Đóng
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 sm:p-5">
              {previewLoading ? (
                <p className="text-sm text-neutral-500">Đang tải…</p>
              ) : preview ? (
                <pre className="text-xs font-mono whitespace-pre-wrap break-words text-neutral-800">
                  {preview.content}
                </pre>
              ) : null}
            </div>
            <div className="px-4 sm:px-5 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 sm:gap-3">
              <button
                onClick={closePreview}
                className="text-sm text-neutral-600 px-4 py-2.5 rounded-lg border border-neutral-200 sm:border-0 order-2 sm:order-1"
              >
                Đóng
              </button>
              <button
                onClick={() => previewName && onRestore(previewName)}
                disabled={!preview || saving}
                className="rounded-lg bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium disabled:opacity-40 order-1 sm:order-2"
              >
                Khôi phục bản này
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
