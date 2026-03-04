/**
 * Mock speech-to-text for development.
 * Returns stub transcription without calling audio APIs.
 */

import type { ISpeechToText, TranscriptionResult } from './ISpeechToText';

export class MockSpeechToText implements ISpeechToText {
  async transcribe(_audio: string | Buffer): Promise<TranscriptionResult> {
    return {
      text: '[Mock] Transcription placeholder',
      language: 'en',
      durationSeconds: 0,
    };
  }
}
