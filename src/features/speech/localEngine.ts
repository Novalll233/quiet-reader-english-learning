import { LOCAL_CHUNK_LIMIT, buildLocalRequest, localConfigProblem, localEndpoint } from './localProtocol';
import { createRemoteEngine } from './remoteEngine';
import { getSpeechConfig } from './speechConfig';

// The first request also loads the models into VRAM and warms CUDA; measured at
// over 100 seconds on a 4 GB laptop GPU, with ~2.5 seconds per later sentence.
const TIMEOUT_MS = 180000;

async function synthesizeLocal(text: string, options: { language: string; rate?: number }) {
  const config = getSpeechConfig();
  const local = { refAudioPath: config.localRef, promptText: config.localPrompt, promptLang: config.localPromptLang };
  const problem = localConfigProblem(local);
  if (problem) throw new Error(problem);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(localEndpoint(config.localUrl), {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildLocalRequest(text, options.language, local, options.rate ?? 1)),
    });
    if (!response.ok) throw new Error(`本地服务返回 HTTP ${response.status}，请确认 api_v2.py 正在运行并监听 0.0.0.0`);
    const audio = new Uint8Array(await response.arrayBuffer());
    if (!audio.length) throw new Error('本地服务没有返回音频');
    return audio;
  } finally { clearTimeout(timer); }
}

/** GPT-SoVITS on the local network: a fine-tuned voice, no cloud, no key. */
export function createLocalEngine() {
  return createRemoteEngine(synthesizeLocal, { provider: 'local', cooldownMs: 45000, extension: 'wav', chunkLimit: LOCAL_CHUNK_LIMIT });
}

/** Settings-screen check: proves the phone can reach the service at all. */
export async function probeLocal() {
  const started = Date.now();
  await synthesizeLocal('你好，这是一次朗读测试。', { language: 'zh-CN' });
  return `本地服务连接成功 · ${Date.now() - started} ms（首次加载模型可能较慢）`;
}