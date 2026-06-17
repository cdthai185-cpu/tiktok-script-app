"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type Script, type GenerateResponse, type VariantAttempt } from "../../lib/api";

export default function EditScriptPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GenerateResponse | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.getScript(id);
        setScript(s);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function onSave() {
    if (!script) return;
    setSaving(true);
    setErr(null);
    try {
      const updated = await api.updateScript(id, {
        title: script.title,
        input_text: script.input_text,
        generated_text: script.generated_text,
      });
      setScript(updated);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onGenerate() {
    if (!script || !script.input_text.trim()) {
      setErr("Cần có mô tả video trước khi sinh kịch bản.");
      return;
    }
    setGenerating(true);
    setErr(null);
    setGenResult(null);
    try {
      const data = await api.generateForScript(id);
      setGenResult(data);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function pickVariant(att: VariantAttempt) {
    if (!script) return;
    const combined = att.hints
      ? `${att.script}\n\n[GỢI Ý HÌNH]:\n${att.hints}`
      : att.script;
    setScript({ ...script, generated_text: combined });
    setGenResult(null);
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 sm:py-10 text-sm text-neutral-500">
        Đang tải…
      </main>
    );
  }
  if (err && !script) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
        <p className="text-red-600 text-sm break-words">{err}</p>
        <Link href="/" className="text-sm underline mt-3 inline-block">← Về trang chính</Link>
      </main>
    );
  }
  if (!script) return null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Về trang chính</Link>
      <h1 className="text-xl sm:text-2xl font-semibold mt-2 mb-6">Sửa kịch bản</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Tiêu đề</label>
          <input
            value={script.title}
            onChange={(e) => setScript({ ...script, title: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Mô tả video (input)</label>
          <textarea
            value={script.input_text}
            onChange={(e) => setScript({ ...script, input_text: e.target.value })}
            rows={5}
            className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div>
              <div className="font-medium text-sm">Sinh kịch bản bằng AI</div>
              <div className="text-xs text-neutral-500">
                3 bản mỗi lần, mỗi bản tự chấm 9 tiêu chí. Mất ~30-60 giây.
              </div>
            </div>
            <button
              onClick={onGenerate}
              disabled={generating || !script.input_text.trim()}
              className="rounded-lg bg-indigo-600 text-white px-5 py-2.5 text-sm font-medium disabled:opacity-40 w-full sm:w-auto"
            >
              {generating ? "Đang sinh…" : "✨ Sinh 3 bản"}
            </button>
          </div>

          {generating && (
            <div className="text-xs text-neutral-500 mt-2">
              Đang gọi Claude sinh + chấm critique. Đừng tắt tab.
            </div>
          )}

          {genResult && (
            <div className="mt-4 space-y-3">
              <div className="text-xs text-neutral-500">
                Few-shot: {genResult.samples_used} mẫu. Click "Dùng bản này" để chèn vào ô bên dưới.
              </div>
              {genResult.variants.map((v) => {
                const att = v.chosen;
                if (!att) return null;
                return <VariantCard key={v.variant_index} index={v.variant_index} att={att} onPick={pickVariant} />;
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            Kịch bản đã sinh (sửa thoải mái)
          </label>
          <textarea
            value={script.generated_text}
            onChange={(e) => setScript({ ...script, generated_text: e.target.value })}
            rows={14}
            placeholder="Bấm '✨ Sinh 3 bản' ở trên hoặc tự viết."
            className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium disabled:opacity-50 w-full sm:w-auto"
          >
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
          {savedAt && <span className="text-xs text-neutral-500">Đã lưu lúc {savedAt}</span>}
          {err && <span className="text-sm text-red-600 break-words">{err}</span>}
        </div>

        <div className="text-xs text-neutral-400 pt-2 border-t border-neutral-100 break-words">
          ID #{script.id} · tạo {new Date(script.created_at).toLocaleString()} ·
          cập nhật {new Date(script.updated_at).toLocaleString()}
        </div>
      </div>
    </main>
  );
}

function VariantCard({
  index,
  att,
  onPick,
}: {
  index: number;
  att: VariantAttempt;
  onPick: (att: VariantAttempt) => void;
}) {
  const [showScores, setShowScores] = useState(false);
  const failedCount = Object.values(att.critique.scores).filter((s) => !s.pass).length;
  const ok = att.pass;

  return (
    <div
      className={`rounded-lg border p-3 sm:p-4 ${ok ? "border-emerald-200 bg-white" : "border-amber-200 bg-amber-50/40"}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Bản {index + 1}</span>
          {ok ? (
            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 text-xs">
              PASS
            </span>
          ) : (
            <span className="text-amber-800 bg-amber-100 border border-amber-300 rounded px-2 py-0.5 text-xs">
              {failedCount} fail
            </span>
          )}
          <span className="text-xs text-neutral-500">{att.word_count} từ</span>
        </div>
        <button
          onClick={() => onPick(att)}
          className="rounded-lg bg-neutral-900 text-white px-3 py-1.5 text-xs font-medium"
        >
          Dùng bản này →
        </button>
      </div>

      <pre className="text-sm whitespace-pre-wrap break-words font-sans leading-relaxed text-neutral-800">
        {att.script}
      </pre>

      {att.hints && (
        <div className="mt-2 text-xs text-neutral-600 border-t border-neutral-200 pt-2">
          <div className="font-medium mb-1">Gợi ý hình</div>
          <pre className="whitespace-pre-wrap font-sans">{att.hints}</pre>
        </div>
      )}

      <button
        onClick={() => setShowScores((v) => !v)}
        className="mt-2 text-xs text-neutral-500 hover:underline"
      >
        {showScores ? "Ẩn chấm điểm" : "Xem chấm điểm 9 tiêu chí"}
      </button>
      {showScores && (
        <div className="mt-2 text-xs space-y-1">
          {Object.entries(att.critique.scores).map(([k, v]) => (
            <div key={k} className="flex items-start gap-2">
              <span className={v.pass ? "text-emerald-600" : "text-red-600"}>
                {v.pass ? "✓" : "✗"}
              </span>
              <span className="font-medium">{k}:</span>
              <span className="text-neutral-600">{v.reason}</span>
            </div>
          ))}
          {att.critique.summary && (
            <div className="text-neutral-500 italic pt-1 border-t border-neutral-200 mt-1">
              {att.critique.summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
