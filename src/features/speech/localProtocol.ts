// A GPT-SoVITS api_v2.py server on the local network gives this reader a
// fine-tuned voice with no cloud dependency. Its generation loop stops past
// roughly 1500 semantic tokens (~30s), so segments must stay short.
export const LOCAL_CHUNK_LIMIT = 90;

export function localEndpoint(baseUrl: string) {
  const value = baseUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s]+$/i.test(value)) throw new Error('请输入形如 http://192.168.1.5:9880 的地址');
  return `${value}/tts`;
}

export function localTextLangFor(language: string) {
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export type LocalSpeechConfig = { refAudioPath: string; promptText: string; promptLang: string };

export function buildLocalRequest(text: string, language: string, config: LocalSpeechConfig, rate = 1) {
  return {
    text,
    text_lang: localTextLangFor(language),
    ref_audio_path: config.refAudioPath.trim(),
    prompt_text: config.promptText,
    prompt_lang: config.promptLang.trim() || 'zh',
    media_type: 'wav',
    streaming_mode: false,
    speed_factor: rate,
    // Sampling defaults copied from the plugin's own client: its "stop losing
    // sentences" fix relies on them, and the server defaults drop words.
    text_split_method: 'cut2',
    batch_size: 1,
    parallel_infer: false,
    repetition_penalty: 1.35,
    temperature: 0.7,
    top_k: 10,
    top_p: 0.9,
    fragment_interval: 0.4,
  };
}

/** A missing reference line is worth reporting before the server answers 400. */
export function localConfigProblem(config: LocalSpeechConfig) {
  if (!config.refAudioPath.trim()) return '请填写参考音频在电脑上的完整路径';
  if (!config.promptLang.trim()) return '请填写参考音频的语言（zh / en / ja）';
  return '';
}