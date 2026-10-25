import test from 'node:test';
import assert from 'node:assert/strict';
import { AZURE_CHUNK_LIMIT, azureEndpoint, azureVoiceFor, buildAzureSsml } from '../src/features/speech/azureProtocol';
import { LOCAL_CHUNK_LIMIT, buildLocalRequest, localConfigProblem, localEndpoint } from '../src/features/speech/localProtocol';
import { createChainEngine, type SpeechEngine } from '../src/features/speech/speechController';

test('the azure endpoint follows the region and rejects a bad one', () => {
  assert.equal(azureEndpoint('eastasia'), 'https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1');
  assert.equal(azureEndpoint(' EastAsia '), 'https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1');
  assert.throws(() => azureEndpoint('bad region!'));
});

test('azure reuses the same voices per spoken language', () => {
  assert.equal(azureVoiceFor('zh-CN'), 'zh-CN-XiaoyiNeural');
  assert.equal(azureVoiceFor('en-US'), 'en-US-AndrewMultilingualNeural');
});

test('azure ssml adds a style only when one is configured', () => {
  const plain = buildAzureSsml('Tom & Jerry', 'voice', 1);
  assert.ok(plain.includes('Tom &amp; Jerry'));
  assert.ok(!plain.includes('mstts:express-as'));
  const styled = buildAzureSsml('hello', 'voice', 0.9, 'gentle');
  assert.ok(styled.includes('<mstts:express-as style="gentle">'));
  assert.ok(styled.includes('rate="-10%"'));
});

test('the local endpoint normalises the base url', () => {
  assert.equal(localEndpoint('http://192.168.1.5:9880/'), 'http://192.168.1.5:9880/tts');
  assert.throws(() => localEndpoint('192.168.1.5:9880'));
});

test('a missing reference audio is reported before the request', () => {
  assert.ok(localConfigProblem({ refAudioPath: '', promptText: '', promptLang: 'zh' }).includes('参考音频'));
  assert.ok(localConfigProblem({ refAudioPath: 'D:\\a.wav', promptText: '', promptLang: '' }).includes('语言'));
  assert.equal(localConfigProblem({ refAudioPath: 'D:\\a.wav', promptText: 'x', promptLang: 'zh' }), '');
});

test('the local request matches the api_v2 payload and stays short', () => {
  const body = buildLocalRequest('你好', 'zh-CN', { refAudioPath: ' D:\\ref.wav ', promptText: '参考', promptLang: 'zh' });
  assert.equal(body.text_lang, 'zh');
  assert.equal(body.ref_audio_path, 'D:\\ref.wav');
  assert.equal(body.prompt_text, '参考');
  assert.equal(body.media_type, 'wav');
  assert.equal(body.streaming_mode, false);
  assert.equal(body.speed_factor, 1);
  // The tuned sampling values are what stop the server dropping words.
  assert.equal(body.repetition_penalty, 1.35);
  assert.equal(body.temperature, 0.7);
  assert.equal(body.top_k, 10);
  assert.equal(body.text_split_method, 'cut2');
  assert.equal(body.fragment_interval, 0.4);
  assert.equal(buildLocalRequest('hi', 'en-US', { refAudioPath: 'r', promptText: '', promptLang: 'zh' }, 0.9).speed_factor, 0.9);
  assert.equal(LOCAL_CHUNK_LIMIT, 90);
  assert.ok(AZURE_CHUNK_LIMIT > LOCAL_CHUNK_LIMIT);
});

const speakOptions = { language: 'en-US', rate: 0.9, onDone: () => {}, onStopped: () => {}, onError: () => {} };

function fakeEngines() {
  const calls: string[] = [];
  const finish: Record<string, (ok: boolean) => void> = {};
  const make = (label: string, options: { fail?: boolean; limit?: number } = {}): SpeechEngine => ({
    speak: (_text, speakOptions) => {
      calls.push(label);
      finish[label] = ok => (ok ? speakOptions.onDone() : speakOptions.onError(new Error(`${label} failed`)));
    },
    stop: async () => { calls.push(`${label}:stop`); },
    chunkLimit: options.limit === undefined ? undefined : () => options.limit as number,
  });
  return { calls, finish, make };
}

test('the preferred engine speaks first and its success ends the chain', () => {
  const { calls, finish, make } = fakeEngines();
  const chain = createChainEngine(() => [make('local'), make('azure'), make('system')]);
  const done: string[] = [];
  chain.speak('hello', { ...speakOptions, onDone: () => done.push('done') });
  assert.deepEqual(calls, ['local']);
  finish.local(true);
  assert.deepEqual(done, ['done']);
  assert.deepEqual(calls, ['local']);
});

test('failures cascade down to the system voice', () => {
  const { calls, finish, make } = fakeEngines();
  const chain = createChainEngine(() => [make('local'), make('azure'), make('system')]);
  chain.speak('hello', speakOptions);
  finish.local(false);
  assert.deepEqual(calls, ['local', 'azure']);
  finish.azure(false);
  assert.deepEqual(calls, ['local', 'azure', 'system']);
});

test('an exhausted chain reports an error instead of hanging', () => {
  const { finish, make } = fakeEngines();
  const chain = createChainEngine(() => [make('local'), make('azure')]);
  const errors: string[] = [];
  chain.speak('hello', { ...speakOptions, onError: error => errors.push(error.message) });
  finish.local(false);
  finish.azure(false);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('没有可用'));
});

test('the chain asks for the preferred engine chunk limit', () => {
  const { make } = fakeEngines();
  const chain = createChainEngine(() => [make('local', { limit: 90 }), make('system')]);
  assert.equal(chain.chunkLimit?.(), 90);
  assert.equal(createChainEngine(() => [make('system')]).chunkLimit?.(), 0);
});

test('stopping silences every engine in the chain', async () => {
  const { calls, make } = fakeEngines();
  await createChainEngine(() => [make('local'), make('azure'), make('system')]).stop();
  assert.deepEqual(calls, ['local:stop', 'azure:stop', 'system:stop']);
});