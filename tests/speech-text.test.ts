import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSpeechText, speechLanguageFor, speechRateFor, splitSpeechChunks } from '../src/features/speech/speechText';

test('selections are cleaned before they reach the engine', () => {
  assert.equal(cleanSpeechText('  Petey\u00A0whimpered\nand licked  Josh’s face. '), 'Petey whimpered and licked Josh’s face.');
  assert.equal(cleanSpeechText('lic\u00ADked'), 'licked');
  assert.equal(cleanSpeechText('\u200B'), '');
  assert.equal(cleanSpeechText(undefined as unknown as string), '');
});

test('latin text keeps an English voice and pure Chinese switches', () => {
  assert.equal(speechLanguageFor('Petey whimpered.'), 'en-US');
  assert.equal(speechLanguageFor('一只小狗'), 'zh-CN');
  assert.equal(speechLanguageFor('Josh 说 stop'), 'en-US');
});

test('a single sentence stays one chunk', () => {
  assert.deepEqual(splitSpeechChunks('“Stop it, Petey,” Josh scolded.'), ['“Stop it, Petey,” Josh scolded.']);
});

test('long selections split on sentence boundaries under the limit', () => {
  const text = Array.from({ length: 60 }, (_, index) => `Sentence number ${index} carries some words.`).join(' ');
  const chunks = splitSpeechChunks(text, 120);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.length <= 120, chunk);
  // Chunking must not lose or duplicate a single word.
  assert.equal(chunks.join(' ').replace(/\s+/g, ' ').trim(), text.replace(/\s+/g, ' ').trim());
});

test('an oversized sentence is cut on spaces, never mid-word', () => {
  const word = 'antidisestablishmentarianism';
  const text = Array.from({ length: 40 }, () => word).join(' ');
  const chunks = splitSpeechChunks(text, 50);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 50);
    for (const piece of chunk.split(' ')) assert.equal(piece, word);
  }
});

test('empty selections produce no chunks', () => {
  assert.deepEqual(splitSpeechChunks(''), []);
  assert.deepEqual(splitSpeechChunks('   \n\t '), []);
});

test('word pronunciation keeps its original pace', () => {
  assert.equal(speechRateFor('word'), 0.85);
  assert.ok(speechRateFor('sentence') > 0);
});