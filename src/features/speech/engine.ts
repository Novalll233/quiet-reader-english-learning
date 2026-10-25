import * as Speech from 'expo-speech';
import { AppState } from 'react-native';
import { createEdgeEngine } from './edgeEngine';
import { createFallbackEngine, createSpeechController, type SpeechEngine } from './speechController';
import { DEFAULT_SPEECH_LIMIT } from './speechText';

// One reader-wide queue: the selected toolbar disappears when the WebView
// rebuilds, so nothing here may live inside a screen component.
const systemEngine: SpeechEngine = {
  speak: (text, options) => Speech.speak(text, {
    language: options.language,
    rate: options.rate,
    onDone: options.onDone,
    onStopped: options.onStopped,
    onError: options.onError,
  }),
  stop: () => Speech.stop(),
};

function platformLimit() {
  const value = Speech.maxSpeechInputLength;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(value, DEFAULT_SPEECH_LIMIT) : DEFAULT_SPEECH_LIMIT;
}

// The natural online voice is tried first; the offline system voice keeps
// working when the network, the endpoint or the device says no.
const engine = createFallbackEngine(createEdgeEngine(), systemEngine);

export const speechController = createSpeechController(engine, { limit: platformLimit() });

// Reading aloud must not survive leaving the app.
AppState.addEventListener('change', state => { if (state !== 'active') void speechController.stop(); });