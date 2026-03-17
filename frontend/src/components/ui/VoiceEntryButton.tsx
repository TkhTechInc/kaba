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
import { useLocale } from "@/contexts/locale-context";
import { createAiApi, type VoiceTransactionResult } from "@/services/ai.service";
import { useFeatures } from "@/hooks/use-features";
import { getCurrencyForCountry } from "@/lib/country-currency";

interface VoiceEntryButtonProps {
  token: string | null;
  businessId: string;
  /** Business currency. Callers should pass balance?.currency or features.currency from business (derived from country at onboarding). */
  currency?: string;
  /** Ledger balance from API; used for currency when available (balance.currency comes from business) */
  balance?: { currency?: string } | null;
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


export function VoiceEntryButton({
  token,
  businessId,
  currency: currencyProp,
  balance,
  onSuccess,
  onError,
  className = "",
}: VoiceEntryButtonProps) {
  const { t } = useLocale();
  const features = useFeatures(businessId);
  const currency =
    currencyProp ??
    balance?.currency ??
    features.currency ??
    getCurrencyForCountry(features.countryCode ?? "");
  const [state, setState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref so the onend closure always sees the latest transcript, not the stale closure value
  const transcriptRef = useRef("");
  // Set to true by onerror so onend (which always fires after onerror) doesn't double-fire
  const speechErroredRef = useRef(false);

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
        // api.post<T> returns ApiResponse<T> = { success, data: T }
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
        // Use FileReader instead of Buffer (Buffer is not available in the browser)
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            // Strip "data:audio/webm;base64," prefix
            resolve(dataUrl.split(",")[1] ?? "");
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
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
    // Single-utterance mode: interimResults=false avoids onend firing before final result
    recognition.continuous = false;
    recognition.interimResults = false;
    // Chrome requires an explicit lang. Use browser lang but normalise to a supported tag.
    // West African users often have fr-FR or en-US — both work well enough for mixed speech.
    recognition.lang = navigator.language || "fr-FR";
    recognition.maxAlternatives = 1;

    speechErroredRef.current = false;

    recognition.onstart = () => {
      setState("listening");
      setStatusMessage("Listening… speak now");
      // Auto-stop after 10 s so the button never gets stuck
      autoStopTimerRef.current = setTimeout(() => {
        recognition.stop();
      }, 10_000);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) text += r[0].transcript;
      }
      if (text) {
        transcriptRef.current = text;
        setTranscript(text);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      // Mark errored so onend (which always fires after onerror) skips sendText
      speechErroredRef.current = true;
      recognitionRef.current = null;
      transcriptRef.current = "";

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

    recognition.onend = () => {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      // onerror always triggers onend — skip if we already handled the error
      if (speechErroredRef.current) {
        speechErroredRef.current = false;
        return;
      }
      const text = transcriptRef.current;
      transcriptRef.current = "";
      recognitionRef.current = null;
      sendText(text);
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }, [onError, sendText]);

  // ── MediaRecorder fallback path ───────────────────────────────────────────

  const startMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick the best supported MIME type (webm on Chrome/Firefox, mp4 on Safari)
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) =>
        MediaRecorder.isTypeSupported(m)
      ) ?? "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (autoStopTimerRef.current) {
          clearTimeout(autoStopTimerRef.current);
          autoStopTimerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        const type = mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type });
        await sendAudio(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("recording");
      setStatusMessage("Recording… tap again to stop");

      // Auto-stop after 30 s to prevent runaway recordings
      autoStopTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 30_000);
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
    transcriptRef.current = "";
    speechErroredRef.current = false;

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
    state === "idle" ? t("voice.recordTransaction")
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
