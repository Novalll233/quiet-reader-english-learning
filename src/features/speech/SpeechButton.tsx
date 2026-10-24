import { useMemo } from 'react';
import { Square, Volume2 } from 'lucide-react-native';
import { IconButton } from '../../components/IconButton';
import { cleanSpeechText } from './speechText';
import { useSpeech } from './useSpeech';

/** Reads the current selection aloud and turns into the stop control while it plays. */
export function SpeechButton({ text, rate, label = '朗读选中的内容' }: { text: string; rate?: number; label?: string }) {
  const { speaking, spokenText, speak, stop } = useSpeech();
  const value = useMemo(() => cleanSpeechText(text), [text]);
  const playing = speaking && spokenText === value;
  return <IconButton
    icon={playing ? Square : Volume2}
    label={playing ? '停止朗读' : label}
    selected={playing}
    disabled={!value}
    onPress={() => { if (playing) void stop(); else void speak(value, rate === undefined ? undefined : { rate }); }}
  />;
}