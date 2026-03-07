/** Injection tokens for AI module */

// Legacy / default — still used for fallback and backward compat
export const AI_PROVIDER = 'AI_PROVIDER';
export const AI_LLM_PROVIDER = 'AI_LLM_PROVIDER';
export const AI_RECEIPT_EXTRACTOR = 'AI_RECEIPT_EXTRACTOR';
export const AI_SPEECH_TO_TEXT = 'AI_SPEECH_TO_TEXT';

// Per-task specialised providers
// Each resolves to an ILLMProvider instance tuned for that task.

/** Fast, cheap model for chat intent classification (e.g. Mistral Small 3.2) */
export const AI_INTENT_PARSER_PROVIDER = 'AI_INTENT_PARSER_PROVIDER';

/** Multilingual model for voice-to-transaction extraction (e.g. Qwen3.5-Flash) */
export const AI_VOICE_PROVIDER = 'AI_VOICE_PROVIDER';

/** Reasoning model for loan readiness scoring (e.g. DeepSeek R1) */
export const AI_LOAN_PROVIDER = 'AI_LOAN_PROVIDER';

/** Balanced model for ledger Q&A (e.g. Llama 3.3 70B) */
export const AI_LEDGER_QA_PROVIDER = 'AI_LEDGER_QA_PROVIDER';

/** Vision-language model for receipt image extraction (e.g. Qwen3 VL 235B) */
export const AI_VISION_PROVIDER = 'AI_VISION_PROVIDER';

/** Embedding model for semantic search (e.g. Qwen3 Embedding 8B) */
export const AI_EMBEDDING_PROVIDER = 'AI_EMBEDDING_PROVIDER';
