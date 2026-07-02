"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  api,
  type Script,
  type GenerateResponse,
  type VariantAttempt,
  STYLE_TONE_OPTIONS,
} from "../../lib/api";

function estimateWords(duration: number, tone: string): { min: number; target: number; max: number } {
  const wpm: Record<string, number> = {
    default: 140, humor: 155, deep: 120, storytelling: 135, energetic: 170, selfmock: 145,
  };
  const rate = wpm[tone] ?? 140;
  const target = Math.max(30, Math.round((duration * rate) / 60));
  const delta = Math.max(10, Math.round(target * 0.15));
  return { min: Math.max(20, target - delta), target, max: target + delta };
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}p${r > 0 ? ` ${r}s` : ""}` : `${r}s`;
}

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

  // Q&A state
  const [askingQ, setAskingQ] = useState(false);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);

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

  const wordRange = useMemo(() => {
    if (!script) return null;
    return estimateWords(script.duration_seconds || 60, script.style_tone || "default");
  }, [script?.duration_seconds, script?.style_tone]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSave() {
    if (!script) return;
    setSaving(true);
    setErr(null);
    try {
      const updated = await api.updateScript(id, {
        title: script.title,
        input_text: script.input_text,
        generated_text: script.generated_text,
        duration_seconds: script.duration_seconds,
        style_tone: script.style_tone,
        context_qa: script.context_qa,
      });
      setScript(updated);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onAskQuestions() {
    if (!script || !script.input_text.trim()) {
      setErr("Cần có mô tả video trước khi hỏi.");
      return;
    }
    setAskingQ(true);
    setErr(null);
    setQuestions(null);
    try {
      // Save duration trước khi hỏi (để backend dùng đúng)
      await api.updateScript(id, {
        duration_seconds: script.duration_seconds,
      });
      const res = await api.suggestQuestionsForScript(id);
      setQuestions(res.questions);
      // Init answers array cùng độ dài
      const existing = script.context_qa || "";
      setAnswers(res.questions.map(() => existing ? "" : ""));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAskingQ(false);
    }
  }

  async function onSaveAnswers() {
    if (!script || !questions) return;
    const packed = questions
      .map((q, i) => {
        const a = (answers[i] || "").trim();
        return a ? `Q${i + 1}: ${q}\nA: ${a}` : "";
      })
      .filter(Boolean)
      .join("\n\n");

    setSaving(true);
    setErr(null);
    try {
      const updated = await api.updateScript(id, { context_qa: packed });
      setScript(updated);
      setQuestions(null);
      setAnswers([]);
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
    // Save trước để backend đọc duration/tone/context_qa mới nhất
    await api.updateScript(id, {
      duration_seconds: script.duration_seconds,
      style_tone: script.style_tone,
      context_qa: script.context_qa,
    });
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
          <label className="block text-xs font-medium text-neutral-600 mb-1">Mô tả thô video (input)</label>
          <textarea
            value={script.input_text}
            onChange={(e) => setScript({ ...script, input_text: e.target.value })}
            rows={5}
            className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>

        {/* === DURATION + TONE === */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Thời lượng video (giây)
            </label>
            <input
              type="number"
              min={10}
              max={600}
              value={script.duration_seconds || 60}
              onChange={(e) =>
                setScript({ ...script, duration_seconds: Math.max(10, Number(e.target.value) || 60) })
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
            {wordRange && (
              <div className="text-xs text-neutral-500 mt-1">
                = {formatDuration(script.duration_seconds || 60)} · target ~
                <span className="font-medium text-neutral-800">{wordRange.target} từ</span>{" "}
                (chấp nhận {wordRange.min}-{wordRange.max})
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Văn phong</label>
            <select
              value={script.style_tone || "default"}
              onChange={(e) => setScript({ ...script, style_tone: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              {STYLE_TONE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="text-xs text-neutral-500 mt-1">
              {STYLE_TONE_OPTIONS.find((o) => o.value === (script.style_tone || "default"))?.hint}
            </div>
          </div>
        </div>

        {/* === Q&A === */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div>
              <div className="font-medium text-sm">Hỏi thêm để bám sát video (tuỳ chọn)</div>
              <div className="text-xs text-neutral-600">
                App sẽ hỏi 5 câu cụ thể (mốc thời gian, cảm xúc, quote…). Anh trả lời càng chi tiết,
                kịch bản càng sát cảnh quay.
              </div>
            </div>
            <button
              onClick={onAskQuestions}
              disabled={askingQ || !script.input_text.trim()}
              className="rounded-lg bg-blue-600 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-40 w-full sm:w-auto"
            >
              {askingQ ? "Đang sinh câu hỏi…" : "🎯 Hỏi thêm để rõ"}
            </button>
          </div>

          {questions && (
            <div className="mt-3 space-y-3 border-t border-blue-200 pt-3">
              {questions.map((q, i) => (
                <div key={i}>
                  <label className="block text-xs font-medium text-blue-900 mb-1">
                    <span className="text-blue-700">Q{i + 1}.</span> {q}
                  </label>
                  <textarea
                    value={answers[i] || ""}
                    onChange={(e) => {
                      const next = [...answers];
                      next[i] = e.target.value;
                      setAnswers(next);
                    }}
                    rows={2}
                    placeholder="Trả lời ngắn…"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={onSaveAnswers}
                  disabled={saving}
                  className="rounded-lg bg-blue-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Dùng câu trả lời này
                </button>
                <button
                  onClick={() => { setQuestions(null); setAnswers([]); }}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
                >
                  Bỏ
                </button>
              </div>
            </div>
          )}

          {!questions && script.context_qa && (
            <div className="mt-2 text-xs text-neutral-600 border-t border-blue-200 pt-2">
              <div className="font-medium mb-1">Context đã lưu:</div>
              <pre className="whitespace-pre-wrap font-sans max-h-32 overflow-auto bg-white/60 rounded p-2 text-[11px]">
                {script.context_qa}
              </pre>
              <button
                onClick={() => setScript({ ...script, context_qa: "" })}
                className="mt-1 text-xs text-red-600 hover:underline"
              >
                Xoá context
              </button>
            </div>
          )}
        </div>

        {/* === GENERATE === */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div>
              <div className="font-medium text-sm">Sinh kịch bản chi tiết</div>
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
              Đang gọi Groq sinh + chấm critique. Đừng tắt tab.
            </div>
          )}

          {genResult && (
            <div className="mt-4 space-y-3">
              <div className="text-xs text-neutral-500">
                {genResult.provider}/{genResult.model} · few-shot {genResult.samples_used} mẫu ·
                target {genResult.word_range?.target} từ
                {genResult.context_qa_used ? " · có context Q&A" : ""}
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
