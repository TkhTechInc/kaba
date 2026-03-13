import { api } from "@/lib/api-client";
import { getCurrencyForCountry } from "@/lib/country-currency";

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
  const opts = { token: token ?? undefined };
  return {
    /**
     * Send transcribed text to the backend for LLM parsing + ledger entry creation.
     * Primary path: browser records → Web Speech API transcribes → this call.
     */
    voiceToTransactionFromText: (
      businessId: string,
      text: string,
      /** Business currency from features/balance. Fallback XOF when omitted. */
      currency?: string
    ) =>
      api.post<VoiceTransactionResult>(
        "/api/v1/ai/voice-to-transaction",
        { businessId, text, currency: currency ?? getCurrencyForCountry("") },
        opts
      ),

    /**
     * Send raw audio (base64) to the backend — Whisper transcribes server-side.
     * Fallback when Web Speech API is unavailable or low accuracy.
     */
    voiceToTransactionFromAudio: (
      businessId: string,
      audioBase64: string,
      /** Business currency from features/balance. Fallback XOF when omitted. */
      currency?: string
    ) =>
      api.post<VoiceTransactionResult>(
        "/api/v1/ai/voice-to-transaction",
        { businessId, audioBase64, currency: currency ?? getCurrencyForCountry("") },
        opts
      ),
  };
}
