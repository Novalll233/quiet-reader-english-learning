import * as Crypto from 'expo-crypto';
import { EDGE_OUTPUT_FORMAT, buildEdgeSsml, edgeGecPayload, edgeSocketUrl, edgeVoiceFor, readAudioFrame } from './edgeProtocol';

// The endpoint expects a browser-extension handshake; React Native accepts
// custom headers as the third WebSocket argument.
const HEADERS = {
  Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
};
const CONNECT_TIMEOUT_MS = 6000;
const SPEAK_TIMEOUT_MS = 20000;
// React Native accepts handshake headers, but the ambient WebSocket type only
// describes the two-argument browser form, so keep the real shape here.
const SocketWithHeaders = WebSocket as unknown as new (
  url: string,
  protocols?: string | string[] | null,
  options?: { headers?: Record<string, string> },
) => WebSocket;
const CONFIG = JSON.stringify({
  context: {
    synthesis: {
      audio: {
        metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
        outputFormat: EDGE_OUTPUT_FORMAT,
      },
    },
  },
});

/** Speaks one chunk with the free Edge neural voice; rejects so the caller can fall back. */
export async function synthesizeEdge(text: string, language: string, rate: number) {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, edgeGecPayload(Date.now()));
  const url = edgeSocketUrl(digest.toUpperCase(), Crypto.randomUUID().replace(/-/g, ''));
  const ssml = buildEdgeSsml(text, edgeVoiceFor(language), rate);
  return await new Promise<Uint8Array>((resolve, reject) => {
    const socket = new SocketWithHeaders(url, undefined, { headers: HEADERS });
    socket.binaryType = 'arraybuffer';
    const chunks: Uint8Array[] = [];
    let settled = false;
    let opened = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch { /* the socket is already closing */ }
      if (error) { reject(error); return; }
      const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const audio = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { audio.set(chunk, offset); offset += chunk.length; }
      resolve(audio);
    };
    timer = setTimeout(() => finish(new Error('在线语音连接超时')), CONNECT_TIMEOUT_MS);
    socket.onopen = () => {
      opened = true;
      clearTimeout(timer);
      timer = setTimeout(() => finish(new Error('在线语音超时')), SPEAK_TIMEOUT_MS);
      socket.send(`X-Timestamp:${new Date().toString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${CONFIG}`);
      socket.send(`X-RequestId:${Crypto.randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toISOString()}\r\nPath:ssml\r\n\r\n${ssml}`);
    };
    socket.onmessage = event => {
      const data = event.data as string | ArrayBuffer;
      if (typeof data === 'string') {
        if (data.includes('Path:turn.end')) {
          if (chunks.length) finish(); else finish(new Error('在线语音没有返回音频'));
        }
        return;
      }
      const frame = readAudioFrame(new Uint8Array(data));
      if (frame?.length) chunks.push(frame);
    };
    socket.onerror = () => finish(new Error('在线语音连接失败'));
    socket.onclose = () => finish(new Error(opened ? '在线语音提前中断' : '在线语音无法连接'));
  });
}