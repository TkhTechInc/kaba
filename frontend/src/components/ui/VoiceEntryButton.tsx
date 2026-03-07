"use client";

/**
 * VoiceEntryButton — mic button that records user speech via Web Speech API,
 * sends the transcript to the backend LLM (Gemma 3 27B intent parse + Qwen3.5-Flash
 * extraction), and calls onSuccess with the created ledger entry.
 *
 * Strategy:
 *   1. Try Web Speech API (browser-native, free, works on Chrome/Edge/Safari iOS 16+)
 *   2. If unavailable, fall back to MediaRecorder + send audio base64 to Whisper on backend
 *
 * Supports Fon, Yoruba, French, English, Pidgin — whatever the user speaks.
 */

import { useRef, useState, useCallback } from "react";
import { createAiApi, type VoiceTransactionResult } from "@/services/ai.service";

interface VoiceEntryButtonProps {
  token: string | null;
  businessId: string;
  currency?: string;
  onSuccess: (entry: VoiceTransactionResult["entry"]) => void;
  onError?: (message: string) => void;
  /** Extra classes for the trigger button */
  className?: string;
}

type RecordingState =
  | "idle"
  | "listening"      // Web Speech API active
  | "recording"      // MediaRecorder fallback active
  | "processing"     // Sending to backend
  | "done"           // Success flash
  | "error";         // Error flash

// Extend Window to include webkit-prefixed SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

export function VoiceEntryButton({
  token,
  businessId,
  currency = "XOF",
  onSuccess,
  onError,
  className = "",
}: VoiceEntryButtonProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const api = createAiApi(token);

  const hasWebSpeech = useCallback(() => {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  const sendText = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setState("error");
        setStatusMessage("Nothing was heard. Try again.");
        onError?.("Nothing was heard.");
        setTimeout(() => setState("idle"), 2000);
        return;
      }

      setState("processing");
      setStatusMessage("Processing…");

      try {
        const res = await api.voiceToTransactionFromText(businessId, text, currency);
        const result = res.data;
        if (result.success && result.entry) {
          setState("done");
          setStatusMessage(`Saved: ${result.entry.type} of ${result.entry.amount}`);
          onSuccess(result.entry);
          setTimeout(() => {
            setState("idle");
            setTranscript("");
            setStatusMessage("");
          }, 2500);
        } else {
          throw new Error(result.error ?? "Could not extract a transaction from that.");
        }
      } catch (e) {
        const msg = (e as Error).message ?? "Failed. Try again.";
        setState("error");
        setStatusMessage(msg);
        onError?.(msg);
        setTimeout(() => {
          setState("idle");
          setStatusMessage("");
        }, 3000);
      }
    },
    [api, businessId, currency, onError, onSuccess]
  );

  const sendAudio = useCallback(
    async (blob: Blob) => {
      setState("processing");
      setStatusMessage("Transcribing audio…");
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const res = await api.voiceToTransactionFromAudio(businessId, base64, currency);
        const result = res.data;
        if (result.success && result.entry) {
          setState("done");
          setStatusMessage(`Saved: ${result.entry.type} of ${result.entry.amount}`);
          onSuccess(result.entry);
          setTimeout(() => {
            setState("idle");
            setTranscript("");
            setStatusMessage("");
          }, 2500);
        } else {
          throw new Error(result.error ?? "Could not extract a transaction.");
        }
      } catch (e) {
        const msg = (e as Error).message ?? "Failed. Try again.";
        setState("error");
        setStatusMessage(msg);
        onError?.(msg);
        setTimeout(() => {
          setState("idle");
          setStatusMessage("");
        }, 3000);
      }
    },
    [api, businessId, currency, onError, onSuccess]
  );

  // ── Web Speech API path ───────────────────────────────────────────────────

  const startWebSpeech = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return false;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    // No lang set — auto-detect. Users can speak Fon, Yoruba, French, English.
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState("listening");
      setStatusMessage("Listening… speak now");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript(final || interim);
    };

    recognition.onend = () => {
      const finalText = recognitionRef.current
        ? transcript
        : "";
      recognitionRef.current = null;
      sendText(finalText || transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        setState("error");
        setStatusMessage("No speech detected. Try again.");
        onError?.("No speech detected.");
      } else if (event.error === "not-allowed") {
        setState("error");
        setStatusMessage("Microphone access denied.");
        onError?.("Microphone access denied.");
      } else {
        setState("error");
        setStatusMessage("Speech recognition error. Try again.");
        onError?.(event.error);
      }
      setTimeout(() => {
        setState("idle");
        setStatusMessage("");
      }, 3000);
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }, [onError, sendText, transcript]);

  // ── MediaRecorder fallback path ───────────────────────────────────────────

  const startMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudio(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("recording");
      setStatusMessage("Recording… tap again to stop");
    } catch {
      setState("error");
      setStatusMessage("Microphone access denied.");
      onError?.("Microphone access denied.");
      setTimeout(() => {
        setState("idle");
        setStatusMessage("");
      }, 3000);
    }
  }, [onError, sendAudio]);

  // ── Main toggle handler ───────────────────────────────────────────────────

  const handleToggle = useCallback(() => {
    if (state === "listening") {
      recognitionRef.current?.stop();
      return;
    }

    if (state === "recording") {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (state !== "idle") return;

    setTranscript("");
    setStatusMessage("");

    if (hasWebSpeech()) {
      startWebSpeech();
    } else {
      startMediaRecorder();
    }
  }, [state, hasWebSpeech, startWebSpeech, startMediaRecorder]);

  // ── Visual state ──────────────────────────────────────────────────────────

  const isActive = state === "listening" || state === "recording";
  const isProcessing = state === "processing";

  const buttonLabel =
    state === "idle" ? "Record transaction"
    : state === "listening" ? "Listening… tap to stop"
    : state === "recording" ? "Recording… tap to stop"
    : state === "processing" ? "Processing…"
    : state === "done" ? "Saved!"
    : "Error — tap to retry";

  return (
    <div className="relative inline-flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isProcessing}
        aria-label={buttonLabel}
        aria-pressed={isActive}
        className={[
          "relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          state === "idle"
            ? "bg-primary text-white shadow-md hover:bg-primary/90 active:scale-95"
            : state === "listening" || state === "recording"
            ? "bg-red text-white shadow-lg"
            : state === "processing"
            ? "cursor-not-allowed bg-primary/60 text-white"
            : state === "done"
            ? "bg-green-500 text-white"
            : "bg-red/70 text-white",
          className,
        ].join(" ")}
      >
        {/* Pulsing ring when active */}
        {isActive && (
          <span className="absolute inset-0 animate-ping rounded-full bg-red opacity-40" />
        )}

        {/* Icon */}
        {isProcessing ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : state === "done" ? (
          <CheckIcon />
        ) : state === "error" ? (
          <XIcon />
        ) : (
          <MicIcon active={isActive} />
        )}
      </button>

      {/* Live transcript preview */}
      {transcript && (
        <p className="max-w-[200px] text-center text-xs text-dark-6 dark:text-dark-4">
          &ldquo;{transcript}&rdquo;
        </p>
      )}

      {/* Status message */}
      {statusMessage && !transcript && (
        <p
          className={`text-center text-xs ${
            state === "error" ? "text-red" : "text-dark-6 dark:text-dark-4"
          }`}
        >
          {statusMessage}
        </p>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
