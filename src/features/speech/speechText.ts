// A reader selection carries layout artefacts (soft hyphens, NBSP, line
// breaks) and can be far longer than one native utterance. Everything here is
// pure so the rules stay testable without a device.
const INVISIBLE = /[\u00AD\u200B-\u200D\uFEFF]/g;
const SPACE_RUN = /[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g;
const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const LATIN = /[A-Za-z]/;
const SENTENCE = /[^.!?…]+[.!?…]*\s*/g;
/** Where a neural voice may pause: stopping elsewhere swallows the last word. */
const CLAUSE = /[,;:、，；：)）】」』—–]/;

/** Android rejects an utterance above its own limit, so stay well under it. */
export const DEFAULT_SPEECH_LIMIT = 3200;
export const DEFAULT_SPEECH_RATE = 0.9;

export function cleanSpeechText(raw: string) {
  if (typeof raw !== 'string') return '';
  return raw.replace(INVISIBLE, '').replace(SPACE_RUN, ' ').trim();
}

/** Latin text must not be read by a Chinese voice, and vice versa. */
export function speechLanguageFor(text: string) {
  if (!CJK.test(text)) return 'en-US';
  return LATIN.test(text) ? 'en-US' : 'zh-CN';
}

export function speechRateFor(kind: 'word' | 'sentence') {
  // Word pronunciation kept its original pace when it moved to the controller.
  return kind === 'word' ? 0.85 : DEFAULT_SPEECH_RATE;
}

function hardSplit(piece: string, limit: number) {
  const parts: string[] = [];
  let rest = piece.trim();
  while (rest.length > limit) {
    // Ending a chunk at punctuation reads as a natural pause. A cut in the
    // middle of a clause makes the voice trail off and drop the last word, so
    // look back for punctuation first and only then fall back to a space.
    let cut = -1;
    for (let index = Math.min(limit, rest.length - 1); index > limit * 0.4; index -= 1) {
      if (CLAUSE.test(rest[index])) { cut = index + 1; break; }
    }
    if (cut <= 0) cut = rest.lastIndexOf(' ', limit);
    if (cut <= 0) cut = limit;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  // A two-word tail reads as a hiccup on its own; keep it with its clause.
  if (!rest) return parts;
  const last = parts[parts.length - 1];
  if (last && rest.length < 12 && last.length + rest.length <= Math.round(limit * 1.15)) {
    parts[parts.length - 1] = `${last} ${rest}`;
    return parts;
  }
  parts.push(rest);
  return parts;
}

/** Split into chunks a single native utterance can hold, preferring sentences. */
export function splitSpeechChunks(text: string, limit = DEFAULT_SPEECH_LIMIT) {
  const cleaned = cleanSpeechText(text);
  if (!cleaned) return [];
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_SPEECH_LIMIT;
  if (cleaned.length <= safeLimit) return [cleaned];
  const pieces = cleaned.match(SENTENCE) ?? [cleaned];
  const chunks: string[] = [];
  let current = '';
  const push = () => {
    const value = current.trim();
    if (value) chunks.push(value);
    current = '';
  };
  for (const piece of pieces) {
    if (piece.length > safeLimit) {
      push();
      chunks.push(...hardSplit(piece, safeLimit));
      continue;
    }
    if ((current + piece).length > safeLimit) push();
    current += piece;
  }
  push();
  // "Mr." ends with a period but not a sentence, so its tail must stay with
  // the clause: a stray "Dawes." would be read as a hiccup of its own.
  const merged: string[] = [];
  for (const chunk of chunks) {
    const previous = merged[merged.length - 1];
    if (previous && chunk.length < 12 && previous.length + chunk.length <= safeLimit) merged[merged.length - 1] = `${previous} ${chunk}`;
    else merged.push(chunk);
  }
  return merged;
}