import { cleanSpeechText, speechLanguageFor, splitSpeechChunks, DEFAULT_SPEECH_LIMIT, DEFAULT_SPEECH_RATE } from './speechText';

/** The native engine is injected so the queue logic stays testable offline. */
export type SpeechEngine = {
  speak: (text: string, options: { language: string; rate: number; onDone: () => void; onStopped: () => void; onError: (error: Error) => void }) => void;
  stop: () => Promise<void>;
};
export type SpeechState = { speaking: boolean; text: string };

export function createSpeechController(engine: SpeechEngine, options: { limit?: number; rate?: number } = {}) {
  const limit = options.limit ?? DEFAULT_SPEECH_LIMIT;
  const listeners = new Set<(state: SpeechState) => void>();
  let state: SpeechState = { speaking: false, text: '' };
  let generation = 0;
  let chunks: string[] = [];
  let index = 0;
  let language = 'en-US';
  let rate = options.rate ?? DEFAULT_SPEECH_RATE;

  function publish(next: SpeechState) {
    state = next;
    for (const listener of Array.from(listeners)) listener(state);
  }
  function speakChunk(token: number) {
    const text = chunks[index];
    if (text === undefined) { publish({ speaking: false, text: '' }); return; }
    engine.speak(text, {
      language,
      rate,
      onDone: () => {
        // A stale utterance must never advance the queue that replaced it.
        if (token !== generation) return;
        index += 1;
        if (index >= chunks.length) publish({ speaking: false, text: '' });
        else speakChunk(token);
      },
      onStopped: () => { if (token === generation) publish({ speaking: false, text: '' }); },
      onError: () => { if (token === generation) publish({ speaking: false, text: '' }); },
    });
  }
  async function stop() {
    // Invalidate first: callbacks from the interrupted utterance arrive later.
    generation += 1;
    chunks = [];
    index = 0;
    const wasActive = state.speaking || Boolean(state.text);
    if (wasActive) publish({ speaking: false, text: '' });
    await engine.stop().catch(() => undefined);
  }
  async function speak(text: string, overrides: { rate?: number } = {}) {
    const cleaned = cleanSpeechText(text);
    const parts = splitSpeechChunks(cleaned, limit);
    const token = generation + 1;
    generation = token;
    chunks = parts;
    index = 0;
    language = speechLanguageFor(cleaned);
    rate = overrides.rate ?? options.rate ?? DEFAULT_SPEECH_RATE;
    // speak() enqueues instead of interrupting, so the old queue is dropped
    // before the first new chunk starts.
    await engine.stop().catch(() => undefined);
    if (token !== generation) return;
    if (!chunks.length) { if (state.speaking || state.text) publish({ speaking: false, text: '' }); return; }
    publish({ speaking: true, text: cleaned });
    speakChunk(token);
  }
  return {
    speak,
    stop,
    getState: () => state,
    isSpeaking: () => state.speaking,
    subscribe(listener: (state: SpeechState) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
export type SpeechController = ReturnType<typeof createSpeechController>;