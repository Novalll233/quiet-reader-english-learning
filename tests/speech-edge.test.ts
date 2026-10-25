import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EDGE_TRUSTED_TOKEN, EDGE_VOICES, buildEdgeSsml, edgeGecPayload, edgeSocketUrl, edgeVoiceFor, readAudioFrame,
} from '../src/features/speech/edgeProtocol';
import { createFallbackEngine, type SpeechEngine } from '../src/features/speech/speechController';

test('the endpoint token is stable within a five minute window', () => {
  const base = Date.UTC(2026, 9, 25, 10, 30, 0);
  assert.equal(edgeGecPayload(base), edgeGecPayload(base + 299000));
  assert.notEqual(edgeGecPayload(base), edgeGecPayload(base + 300000));
  assert.ok(edgeGecPayload(base).endsWith(EDGE_TRUSTED_TOKEN));
});

test('the socket url carries the token and the connection id', () => {
  const url = edgeSocketUrl('ABC123', 'conn-1');
  assert.ok(url.startsWith('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?'));
  assert.ok(url.includes(`TrustedClientToken=${EDGE_TRUSTED_TOKEN}`));
  assert.ok(url.includes('Sec-MS-GEC=ABC123'));
  assert.ok(url.includes('ConnectionId=conn-1'));
});

test('the online voice follows the spoken language', () => {
  assert.equal(edgeVoiceFor('zh-CN'), EDGE_VOICES.zh);
  assert.equal(edgeVoiceFor('EN-us'), EDGE_VOICES.en);
});

test('ssml escapes the selection and carries the slower rate', () => {
  const ssml = buildEdgeSsml('Tom & "Jerry" <run>', 'en-US-AvaMultilingualNeural', 0.9);
  assert.ok(ssml.includes('Tom &amp; &quot;Jerry&quot; &lt;run&gt;'));
  assert.ok(ssml.includes('voice name="en-US-AvaMultilingualNeural"'));
  assert.ok(ssml.includes('rate="-10%"'));
  assert.ok(!buildEdgeSsml('plain text', 'v', 1).includes('<prosody'));
});

test('audio is split out of its frame header', () => {
  const header = new TextEncoder().encode('Path:audio\r\n');
  const frame = new Uint8Array([header.length >> 8, header.length & 0xff, ...header, 1, 2, 3, 4]);
  assert.deepEqual(Array.from(readAudioFrame(frame) ?? []), [1, 2, 3, 4]);
  assert.equal(readAudioFrame(new Uint8Array([0, 5])), null);
  assert.equal(readAudioFrame(new Uint8Array([0, 200, 1, 2])), null);
});

function fakeEngines() {
  const calls: string[] = [];
  const failures: Array<() => void> = [];
  const primary: SpeechEngine = {
    speak: (text, options) => { calls.push(`primary:${text}`); failures.push(() => options.onError(new Error('在线语音连接失败'))); },
    stop: async () => { calls.push('primary:stop'); },
  };
  const secondary: SpeechEngine = {
    speak: text => { calls.push(`secondary:${text}`); },
    stop: async () => { calls.push('secondary:stop'); },
  };
  return { calls, failures, primary, secondary };
}

const options = { language: 'en-US', rate: 0.9, onDone: () => {}, onStopped: () => {}, onError: () => {} };

test('the online voice is preferred while it works', () => {
  const { calls, primary, secondary } = fakeEngines();
  createFallbackEngine(primary, secondary).speak('Petey whimpered.', options);
  assert.deepEqual(calls, ['primary:Petey whimpered.']);
});

test('a failed online voice hands the same text to the system voice', () => {
  const { calls, failures, primary, secondary } = fakeEngines();
  createFallbackEngine(primary, secondary).speak('Petey whimpered.', options);
  failures[0]();
  assert.deepEqual(calls, ['primary:Petey whimpered.', 'secondary:Petey whimpered.']);
});

test('stopping silences both engines', async () => {
  const { calls, primary, secondary } = fakeEngines();
  await createFallbackEngine(primary, secondary).stop();
  assert.deepEqual(calls, ['primary:stop', 'secondary:stop']);
});