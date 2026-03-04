/**
 * Speech-to-text interface — no SDK imports.
 * Implementations (e.g. Whisper, Transcribe) live in separate files.
 */

export interface TranscriptionResult {
  text: string;
  language?: string;
  durationSeconds?: number;
}

export interface ISpeechToText {
  /**
   * Transcribe audio to text.
   * @param audio - URL or Buffer of the audio file
   */
  transcribe(audio: string | Buffer): Promise<TranscriptionResult>;
}
