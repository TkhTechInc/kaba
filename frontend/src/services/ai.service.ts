import { api } from "@/lib/api-client";

export interface VoiceTransactionResult {
  success: boolean;
  entry?: {
    id: string;
    type: string;
    amount: number;
    description: string;
    category: string;
  };
  error?: string;
}

export function createAiApi(token: string | null) {
  return {
    /**
     * Send transcribed text to the backend for LLM parsing + ledger entry creation.
     * This is the primary path: browser records → Web Speech API transcribes → this call.
     */
    voiceToTransactionFromText: (
      businessId: string,
      text: string,
      currency = "XOF"
    ) =>
      api<{ success: boolean; data: VoiceTransactionResult }>(
        "/api/v1/ai/voice-to-transaction",
        {
          method: "POST",
          token: token ?? undefined,
          body: { businessId, text, currency },
        }
      ),

    /**
     * Send raw audio (base64) to the backend — Whisper transcribes server-side.
     * Fallback when Web Speech API is unavailable or low accuracy.
     */
    voiceToTransactionFromAudio: (
      businessId: string,
      audioBase64: string,
      currency = "XOF"
    ) =>
      api<{ success: boolean; data: VoiceTransactionResult }>(
        "/api/v1/ai/voice-to-transaction",
        {
          method: "POST",
          token: token ?? undefined,
          body: { businessId, audioBase64, currency },
        }
      ),
  };
}
