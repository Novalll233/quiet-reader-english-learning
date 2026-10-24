import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechController, type SpeechEngine } from '../src/features/speech/speechController';

function fakeEngine() {
  const spoken: { text: string; options: Parameters<SpeechEngine['speak']>[1] }[] = [];
  let stops = 0;
  const engine: SpeechEngine = {
    speak: (text, options) => { spoken.push({ text, options }); },
    stop: async () => { stops += 1; },
  };
  return { engine, spoken, stops: () => stops };
}

test('speaking a selection drops the previous queue first', async () => {
  const { engine, spoken, stops } = fakeEngine();
  const controller = createSpeechController(engine, { limit: 1000 });
  await controller.speak('Petey whimpered.');
  await controller.speak('Josh set him down.');
  assert.equal(stops(), 2);
  assert.equal(spoken.length, 2);
  assert.equal(spoken[1].text, 'Josh set him down.');
  assert.equal(controller.getState().speaking, true);
  assert.equal(controller.getState().text, 'Josh set him down.');
});

test('a stale onDone cannot advance the queue that replaced it', async () => {
  const { engine, spoken } = fakeEngine();
  const controller = createSpeechController(engine, { limit: 40 });
  const long = Array.from({ length: 20 }, (_, index) => `Word ${index} here.`).join(' ');
  await controller.speak(long);
  assert.equal(spoken.length, 1, 'only the first chunk starts immediately');
  const stale = spoken[0].options;
  await controller.speak('Short one.');
  const current = spoken[1].options;
  stale.onDone();
  assert.equal(spoken.length, 2, 'the replaced queue must not continue');
  current.onDone();
  assert.equal(controller.getState().speaking, false);
});

test('stop is idempotent and ignores callbacks from the stopped chunk', async () => {
  const { engine, spoken, stops } = fakeEngine();
  const controller = createSpeechController(engine, { limit: 1000 });
  await controller.speak('Petey whimpered.');
  await controller.stop();
  await controller.stop();
  assert.equal(controller.getState().speaking, false);
  assert.equal(stops(), 3);
  spoken[0].options.onDone();
  assert.equal(controller.getState().speaking, false);
});

test('chunks are spoken one after another in order', async () => {
  const { engine, spoken } = fakeEngine();
  const controller = createSpeechController(engine, { limit: 40 });
  await controller.speak('First sentence here. Second sentence here. Third sentence here.');
  assert.equal(spoken.length, 1);
  spoken[0].options.onDone();
  assert.equal(spoken.length, 2);
  spoken[1].options.onDone();
  assert.equal(spoken.length, 3);
  spoken[2].options.onDone();
  assert.equal(controller.getState().speaking, false);
  for (const item of spoken) assert.ok(item.text.length <= 40, item.text);
});

test('an empty selection never reaches the engine', async () => {
  const { engine, spoken } = fakeEngine();
  const controller = createSpeechController(engine, { limit: 1000 });
  await controller.speak('   ');
  assert.equal(spoken.length, 0);
  assert.equal(controller.getState().speaking, false);
});

test('subscribers hear every transition', async () => {
  const { engine } = fakeEngine();
  const controller = createSpeechController(engine, { limit: 1000 });
  const seen: boolean[] = [];
  const unsubscribe = controller.subscribe(state => seen.push(state.speaking));
  await controller.speak('Petey whimpered.');
  await controller.stop();
  unsubscribe();
  await controller.speak('After unsubscribe.');
  assert.deepEqual(seen, [true, false]);
});