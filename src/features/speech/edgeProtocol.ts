// Microsoft's Edge "read aloud" endpoint is a WebSocket that authenticates with
// a time-derived token and answers with MP3 frames. Everything that can be pure
// is kept pure so the protocol stays testable without a device.
export const EDGE_TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
export const EDGE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const WIN_EPOCH_SECONDS = 11644473600;

/** The online voices this reader uses, chosen per spoken language. */
export const EDGE_VOICES = { zh: 'zh-CN-XiaoyiNeural', en: 'en-US-AndrewMultilingualNeural' };

/** The exact string the endpoint expects us to hash, rounded to 5 minutes. */
export function edgeGecPayload(nowMs: number) {
  const ticks = Math.floor((nowMs / 1000 + WIN_EPOCH_SECONDS) / 300) * 300 * 1e7;
  return `${ticks}${EDGE_TRUSTED_TOKEN}`;
}

export function edgeSocketUrl(gec: string, connectionId: string) {
  const query = [
    `TrustedClientToken=${EDGE_TRUSTED_TOKEN}`,
    `Sec-MS-GEC=${gec}`,
    'Sec-MS-GEC-Version=1-130.0.2849.68',
    `ConnectionId=${connectionId}`,
  ].join('&');
  return `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?${query}`;
}

export function edgeVoiceFor(language: string) {
  return language.toLowerCase().startsWith('zh') ? EDGE_VOICES.zh : EDGE_VOICES.en;
}

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function buildEdgeSsml(text: string, voice: string, rate: number) {
  const body = escapeXml(text);
  const percent = `${rate < 1 ? '-' : '+'}${Math.round(Math.abs(rate - 1) * 100)}%`;
  const prosody = rate === 1 ? body : `<prosody pitch="+0Hz" rate="${percent}" volume="+0%">${body}</prosody>`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice}">${prosody}</voice></speak>`;
}

/** Binary frames are <2-byte header length><headers><audio>, and audio is split. */
export function readAudioFrame(buffer: Uint8Array) {
  if (buffer.length < 2) return null;
  const headerLength = (buffer[0] << 8) | buffer[1];
  const start = 2 + headerLength;
  if (start >= buffer.length) return null;
  return buffer.subarray(start);
}