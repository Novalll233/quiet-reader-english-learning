import type { SpeechProvider } from '../../types';

/** Which engine actually spoke last, and why the others did not. The reader
 * must stay silent about this; the settings screen is where it belongs. */
export type SpeechStatus = { provider: SpeechProvider | null; at: number; failures: Partial<Record<SpeechProvider, string>> };
const listeners = new Set<() => void>();
let status: SpeechStatus = { provider: null, at: 0, failures: {} };

function publish(next: SpeechStatus) { status = next; listeners.forEach(listener => listener()); }
export function speechSucceeded(provider: SpeechProvider) { publish({ ...status, provider, at: Date.now() }); }
export function speechFailed(provider: SpeechProvider, reason: string) {
  publish({ ...status, failures: { ...status.failures, [provider]: reason } });
}
export function clearSpeechFailures() { publish({ ...status, failures: {} }); }
export function readSpeechStatus() { return status; }
export function subscribeSpeechStatus(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }