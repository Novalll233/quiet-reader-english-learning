// Azure Speech hosts the same neural voices as Edge's read-aloud feature, but
// behind a documented endpoint with an API key and SSML control. Everything
// here is pure so the request shape stays testable without a device.
import { EDGE_VOICES, escapeXml } from './edgeProtocol';

export const AZURE_VOICES = EDGE_VOICES;
// Azure rejects an utterance well before our default chunk size.
export const AZURE_CHUNK_LIMIT = 1200;

export function azureEndpoint(region: string) {
  const value = region.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,32}$/.test(value)) throw new Error('请输入有效的 Azure 区域，例如 eastasia');
  return `https://${value}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

export function azureVoiceFor(language: string) {
  return language.toLowerCase().startsWith('zh') ? AZURE_VOICES.zh : AZURE_VOICES.en;
}

/** An empty style keeps the request safe: not every voice supports styles. */
export function buildAzureSsml(text: string, voice: string, rate: number, style = '') {
  const body = escapeXml(text);
  const percent = `${rate < 1 ? '-' : '+'}${Math.round(Math.abs(rate - 1) * 100)}%`;
  const prosody = rate === 1 ? body : `<prosody rate="${percent}" pitch="+0%">${body}</prosody>`;
  const styled = style ? `<mstts:express-as style="${escapeXml(style)}">${prosody}</mstts:express-as>` : prosody;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US"><voice name="${voice}">${styled}</voice></speak>`;
}