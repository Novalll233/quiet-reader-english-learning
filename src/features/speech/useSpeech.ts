import { useEffect, useState } from 'react';
import { speechController } from './engine';
import type { SpeechState } from './speechController';

/** Subscribe a component to the reader-wide speech queue. */
export function useSpeech() {
  const [state, setState] = useState<SpeechState>(() => speechController.getState());
  useEffect(() => speechController.subscribe(setState), []);
  return {
    speaking: state.speaking,
    spokenText: state.text,
    speak: (text: string, options?: { rate?: number }) => speechController.speak(text, options),
    stop: () => speechController.stop(),
  };
}