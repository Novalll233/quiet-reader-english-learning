import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { synthesizeEdge } from './edgeTts';
import type { SpeechEngine } from './speechController';

// After the network or the endpoint fails, stop paying a timeout on every
// chunk: offline reading should fall back to the system voice immediately.
const ONLINE_COOLDOWN_MS = 120000;

/** Speech engine backed by the free Edge neural voices (online, no API key). */
export function createEdgeEngine(): SpeechEngine {
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
    speak: (text, options) => {
      if (Date.now() < mutedUntil) { options.onError(new Error('在线语音暂时不可用')); return; }
      const token = ++generation;
      void (async () => {
        try {
          const audio = await synthesizeEdge(text, options.language, options.rate);
          // A stop or a newer selection may have landed while we waited.
          if (token !== generation) return;
          const file = new File(Paths.cache, `tts-${token}-${Date.now()}.mp3`);
          file.write(audio);
          const created = createAudioPlayer({ uri: file.uri });
          player = created;
          cached = file;
          subscription = created.addListener('playbackStatusUpdate', status => {
            if (!status.didJustFinish || token !== generation) return;
            release();
            options.onDone();
          });
          created.play();
        } catch (error) {
          mutedUntil = Date.now() + ONLINE_COOLDOWN_MS;
          if (token === generation) release();
          options.onError(error instanceof Error ? error : new Error('在线语音失败'));
        }
      })();
    },
    stop: async () => {
      generation += 1;
      release();
    },
  };
}