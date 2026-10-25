import { synthesizeEdge } from './edgeTts';
import { createRemoteEngine } from './remoteEngine';

/** Free Edge neural voices. No key needed, but the consumer endpoint is
 * frequently unreachable from mainland networks. */
export function createEdgeEngine() {
  return createRemoteEngine(
    (text, options) => synthesizeEdge(text, options.language, options.rate),
    { provider: 'edge', cooldownMs: 120000, extension: 'mp3' },
  );
}