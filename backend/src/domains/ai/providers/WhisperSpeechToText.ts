/**
 * OpenAI Whisper speech-to-text provider.
 * Handles West African languages (Yoruba, Fon, French, Hausa) well.
 * Requires: npm install openai (already installed as dev dep — add to prod if needed)
 * Cost: ~$0.006/minute of audio.
 */

import type { ISpeechToText, TranscriptionResult } from '../ISpeechToText';

export class WhisperSpeechToText implements ISpeechToText {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = 'whisper-1') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async transcribe(audio: string | Buffer): Promise<TranscriptionResult> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = require('openai').default ?? require('openai');
    const client = new OpenAI({ apiKey: this.apiKey });

    let file: { name: string; data: Buffer; type: string };

    if (typeof audio === 'string') {
      // URL — fetch and convert to buffer
      const response = await fetch(audio);
      const arrayBuffer = await response.arrayBuffer();
      file = { name: 'audio.webm', data: Buffer.from(arrayBuffer), type: 'audio/webm' };
    } else {
      file = { name: 'audio.webm', data: audio, type: 'audio/webm' };
    }

    // Whisper accepts a File-like object. In Node.js we use a Blob.
    const blob = new Blob([file.data], { type: file.type });
    const fileObj = new File([blob], file.name, { type: file.type });

    const result = await client.audio.transcriptions.create({
      file: fileObj,
      model: this.model,
      // No language hint — let Whisper auto-detect (better for mixed Fon/French/Yoruba)
      response_format: 'verbose_json',
    }) as { text: string; language?: string; duration?: number };

    return {
      text: result.text,
      language: result.language,
      durationSeconds: result.duration,
    };
  }
}
