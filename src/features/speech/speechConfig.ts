import * as SecureStore from 'expo-secure-store';
import type { ReaderSettings, SpeechProvider } from '../../types';

/** The engines live outside React, so the current speech settings are mirrored
 * here by the settings provider and read synchronously at speak time. */
export type SpeechConfig = {
  provider: SpeechProvider;
  localUrl: string;
  localRef: string;
  localPrompt: string;
  localPromptLang: string;
  azureRegion: string;
  azureStyle: string;
  azureKey: string;
};

const AZURE_KEY = 'quiet-reader.azure-key';
const EMPTY: SpeechConfig = {
  provider: 'system', localUrl: '', localRef: '', localPrompt: '', localPromptLang: 'zh',
  azureRegion: 'eastasia', azureStyle: '', azureKey: '',
};
let current: SpeechConfig = { ...EMPTY };

export function setSpeechConfig(next: Partial<SpeechConfig>) { current = { ...current, ...next }; }
export function getSpeechConfig() { return current; }
export function readAzureKey() { return current.azureKey; }
export function speechConfigFromSettings(settings: ReaderSettings): Partial<SpeechConfig> {
  return {
    provider: settings.speechProvider,
    localUrl: settings.speechLocalUrl,
    localRef: settings.speechLocalRef,
    localPrompt: settings.speechLocalPrompt,
    localPromptLang: settings.speechLocalPromptLang,
    azureRegion: settings.azureRegion,
    azureStyle: settings.azureStyle,
  };
}
export async function loadAzureKey() {
  try { setSpeechConfig({ azureKey: (await SecureStore.getItemAsync(AZURE_KEY)) ?? '' }); }
  catch { /* a missing key only disables the Azure engine */ }
}
export async function saveAzureKey(value: string) {
  await SecureStore.setItemAsync(AZURE_KEY, value.trim());
  setSpeechConfig({ azureKey: value.trim() });
}