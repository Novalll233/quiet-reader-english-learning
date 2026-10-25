import { AZURE_CHUNK_LIMIT, azureEndpoint, azureVoiceFor, buildAzureSsml } from './azureProtocol';
import { createRemoteEngine } from './remoteEngine';
import { getSpeechConfig } from './speechConfig';

const AZURE_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const TIMEOUT_MS = 25000;

async function synthesizeAzure(text: string, options: { language: string; rate: number }) {
  const config = getSpeechConfig();
  if (!config.azureKey) throw new Error('尚未填写 Azure 密钥');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(azureEndpoint(config.azureRegion), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Ocp-Apim-Subscription-Key': config.azureKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': AZURE_FORMAT,
        'User-Agent': 'quiet-reader',
      },
      body: buildAzureSsml(text, azureVoiceFor(options.language), options.rate, config.azureStyle),
    });
    if (!response.ok) throw new Error(`Azure 返回 HTTP ${response.status}`);
    const audio = new Uint8Array(await response.arrayBuffer());
    if (!audio.length) throw new Error('Azure 没有返回音频');
    return audio;
  } finally { clearTimeout(timer); }
}

/** Official Azure endpoint: same voices as Edge, an API key and SSML styles. */
export function createAzureEngine() {
  return createRemoteEngine(synthesizeAzure, { provider: 'azure', cooldownMs: 60000, extension: 'mp3', chunkLimit: AZURE_CHUNK_LIMIT });
}

/** Settings-screen check: proves key and region are accepted here. */
export async function probeAzure() {
  const started = Date.now();
  await synthesizeAzure('This is a speech test.', { language: 'en-US', rate: 1 });
  return `Azure 连接成功 · ${Date.now() - started} ms`;
}