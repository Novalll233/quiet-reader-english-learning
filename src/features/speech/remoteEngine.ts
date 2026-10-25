import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import type { SpeechProvider } from '../../types';
import type { SpeechEngine } from './speechController';
import { speechFailed, speechSucceeded } from './speechStatus';

export type SpeechSynthesis = (text: string, options: { language: string; rate: number }) => Promise<Uint8Array>;

/** A byte-producing engine is the whole difference between the online voices,
 * so caching, playback, interruption and failure cooldown live here once. */
export function createRemoteEngine(
  synthesize: SpeechSynthesis,
  options: { provider: SpeechProvider; cooldownMs: number; extension: string; chunkLimit?: number },
): SpeechEngine {
  let player: AudioPlayer | null = null;
  let subscription: { remove: () => void } | null = null;
  let cached: File | null = null;
  let generation = 0;
  let mutedUntil = 0;
  function release() {
    try { subscription?.remove(); } catch { /* the player may already be gone */ }
    subscription = null;
    try { player?.remove(); } catch { /* the player may already be gone */ }
    player = null;
    try { if (cached?.exists) cached.delete(); } catch { /* the cache file may be gone */ }
    cached = null;
  }
  return {
    speak: (text, speakOptions) => {
      if (Date.now() < mutedUntil) { speakOptions.onError(new Error('刚失败过，暂时停用')); return; }
      const token = ++generation;
      void (async () => {
        try {
          const audio = await synthesize(text, speakOptions);
          // A stop or a newer selection may have landed while we waited.
          if (token !== generation) return;
          release();
          const file = new File(Paths.cache, `tts-${options.provider}-${token}-${Date.now()}.${options.extension}`);
          file.write(audio);
          cached = file;
          const created = createAudioPlayer({ uri: file.uri });
          player = created;
          subscription = created.addListener('playbackStatusUpdate', status => {
            if (!status.didJustFinish || token !== generation) return;
            release();
            speechSucceeded(options.provider);
            speakOptions.onDone();
          });
          created.play();
        } catch (error) {
          const reason = error instanceof Error ? error.message : '在线语音失败';
          mutedUntil = Date.now() + options.cooldownMs;
          speechFailed(options.provider, reason);
          if (token === generation) release();
          speakOptions.onError(new Error(reason));
        }
      })();
    },
    stop: async () => {
      generation += 1;
      release();
    },
    chunkLimit: options.chunkLimit ? () => options.chunkLimit as number : undefined,
  };
}