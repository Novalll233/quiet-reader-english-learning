import * as Speech from 'expo-speech';
import { AppState } from 'react-native';
import type { SpeechProvider } from '../../types';
import { createAzureEngine } from './azureEngine';
import { createEdgeEngine } from './edgeEngine';
import { createLocalEngine } from './localEngine';
import { getSpeechConfig } from './speechConfig';
import { createChainEngine, createSpeechController, type SpeechEngine } from './speechController';
import { speechSucceeded } from './speechStatus';
import { DEFAULT_SPEECH_LIMIT } from './speechText';

// One reader-wide queue: the selected toolbar disappears when the WebView
// rebuilds, so nothing here may live inside a screen component.
const systemEngine: SpeechEngine = {
  speak: (text, options) => Speech.speak(text, {
    language: options.language,
    rate: options.rate,
    onDone: () => { speechSucceeded('system'); options.onDone(); },
    onStopped: options.onStopped,
    onError: options.onError,
  }),
  stop: () => Speech.stop(),
};

const engines: Record<SpeechProvider, SpeechEngine> = {
  local: createLocalEngine(),
  azure: createAzureEngine(),
  edge: createEdgeEngine(),
  system: systemEngine,
};
// The offline system voice is always last: it is the one that cannot fail.
const ORDER: SpeechProvider[] = ['local', 'azure', 'edge', 'system'];

function resolveOrder() {
  const preferred = getSpeechConfig().provider;
  return [preferred, ...ORDER.filter(item => item !== preferred)].map(item => engines[item] ?? systemEngine);
}

function platformLimit() {
  const value = Speech.maxSpeechInputLength;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(value, DEFAULT_SPEECH_LIMIT) : DEFAULT_SPEECH_LIMIT;
}

// The preferred source speaks first; every failure hands the same text to the
// next one, so reading never stops because a voice is unreachable.
const engine = createChainEngine(resolveOrder);

export const speechController = createSpeechController(engine, { limit: platformLimit() });

// Reading aloud must not survive leaving the app.
AppState.addEventListener('change', state => { if (state !== 'active') void speechController.stop(); });