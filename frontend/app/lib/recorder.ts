"use client";

/**
 * Hook nho nhỏ để ghi âm bằng MediaRecorder.
 * Browser sẽ xin permission micro lần đầu.
 */
import { useCallback, useRef, useState } from "react";

export type RecorderState = "idle" | "requesting" | "recording" | "stopped";

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const start = useCallback(async () => {
    setErr(null);
    setBlob(null);
    setSeconds(0);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Chọn mimeType: ưu tiên webm/opus, fallback theo browser
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const mime =
        candidates.find((c) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) ||
        "";

      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setBlob(finalBlob);
        setState("stopped");
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("recording");

      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        setSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);
    } catch (e) {
      setErr((e as Error).message);
      setState("idle");
    }
  }, []);

  const stop = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (r && r.state !== "inactive") r.stop();
  }, []);

  const reset = useCallback(() => {
    setBlob(null);
    setSeconds(0);
    setErr(null);
    setState("idle");
  }, []);

  return { state, blob, seconds, err, start, stop, reset };
}

export function pickExtension(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}
