import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { Button, Panel } from '../../components/ui';
import type { SpeechProvider } from '../../types';
import { probeAzure } from './azureEngine';
import { probeLocal } from './localEngine';
import { loadAzureKey, readAzureKey, saveAzureKey } from './speechConfig';
import { clearSpeechFailures, readSpeechStatus, subscribeSpeechStatus } from './speechStatus';
import { useSettings } from '../settings/SettingsProvider';

const PROVIDERS: [SpeechProvider, string][] = [
  ['local', '本地服务'],
  ['azure', 'Azure 官方'],
  ['edge', 'Edge 免费在线'],
  ['system', '系统语音'],
];
const providerName = (provider: SpeechProvider | null) => PROVIDERS.find(([key]) => key === provider)?.[1] ?? '尚未朗读';

/** Read-aloud source picker plus the diagnostics that answer "which one works
 * on this network", kept out of the reader so the reading layout is untouched. */
export function SpeechSettings() {
  const { settings, colors, update } = useSettings();
  const [azureKey, setAzureKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(readSpeechStatus());
  useEffect(() => subscribeSpeechStatus(() => setStatus(readSpeechStatus())), []);
  useEffect(() => { let active = true; void loadAzureKey().then(() => { if (active) setAzureKey(readAzureKey()); }); return () => { active = false; }; }, []);
  const input = { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, backgroundColor: colors.background };
  const runTest = (probe: () => Promise<string>) => {
    setBusy(true); setMessage('正在测试…');
    probe().then(result => setMessage(result)).catch(error => setMessage(error instanceof Error ? error.message : '测试失败'))
      .finally(() => setBusy(false));
  };
  return <Panel>
    <Text style={{ color: colors.text, fontSize: 17 }}>朗读声音</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {PROVIDERS.map(([provider, label]) => <Button key={provider} label={label} primary={settings.speechProvider === provider} onPress={() => update({ speechProvider: provider })} />)}
    </View>
    <Text style={{ color: colors.muted, lineHeight: 21 }}>选中优先使用的声音；连不上时自动按「本地服务 → Azure → Edge → 系统语音」往下退，系统语音永远可用。</Text>
    <Text accessibilityRole="alert" style={{ color: colors.text }}>上次成功朗读：{providerName(status.provider)}{status.at ? ` · ${new Date(status.at).toLocaleTimeString()}` : ''}</Text>
    {PROVIDERS.map(([provider, label]) => status.failures[provider]
      ? <Text key={provider} style={{ color: colors.muted }}>{label}：{status.failures[provider]}</Text>
      : null)}
    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
      <Button label={busy ? '测试中…' : '测试本地服务'} disabled={busy} onPress={() => runTest(probeLocal)} />
      <Button label={busy ? '测试中…' : '测试 Azure'} disabled={busy} onPress={() => runTest(probeAzure)} />
      <Button label="清除失败记录" onPress={() => clearSpeechFailures()} />
    </View>
    {message ? <Text accessibilityRole="alert" style={{ color: colors.text, lineHeight: 21 }}>{message}</Text> : null}
    {settings.speechProvider === 'local' ? <>
      <Text style={{ color: colors.muted }}>本地服务地址（GPT-SoVITS api_v2.py，需监听 0.0.0.0）</Text>
      <TextInput accessibilityLabel="本地服务地址" value={settings.speechLocalUrl} onChangeText={speechLocalUrl => update({ speechLocalUrl })} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.5:9880" placeholderTextColor={colors.muted} style={input} />
      <Text style={{ color: colors.muted }}>参考音频在电脑上的完整路径</Text>
      <TextInput accessibilityLabel="参考音频路径" value={settings.speechLocalRef} onChangeText={speechLocalRef => update({ speechLocalRef })} autoCapitalize="none" autoCorrect={false} placeholder="D:\\dania\\ref.wav" placeholderTextColor={colors.muted} style={input} />
      <Text style={{ color: colors.muted }}>参考音频对应的文本</Text>
      <TextInput accessibilityLabel="参考音频文本" value={settings.speechLocalPrompt} onChangeText={speechLocalPrompt => update({ speechLocalPrompt })} multiline style={input} />
      <Text style={{ color: colors.muted }}>参考音频语言（zh / en / ja）</Text>
      <TextInput accessibilityLabel="参考音频语言" value={settings.speechLocalPromptLang} onChangeText={speechLocalPromptLang => update({ speechLocalPromptLang })} autoCapitalize="none" autoCorrect={false} style={input} />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 20 }}>首次朗读需要把模型载入显存，可能等 20–40 秒；之后每段约 1–3 秒。单段上限 90 字符，长句会自动切分。</Text>
    </> : null}
    {settings.speechProvider === 'azure' ? <>
      <Text style={{ color: colors.muted }}>Azure 密钥（保存在系统安全存储中）</Text>
      <TextInput accessibilityLabel="Azure 密钥" secureTextEntry editable={!busy} value={azureKey} onChangeText={value => { setAzureKey(value); setSaved(false); }} autoCapitalize="none" autoCorrect={false} style={input} />
      <Button disabled={busy || !azureKey.trim()} label={saved ? '已保存' : '保存密钥'} onPress={() => { setBusy(true); setMessage(''); void saveAzureKey(azureKey).then(() => setSaved(true)).catch(() => setMessage('密钥保存失败')).finally(() => setBusy(false)); }} />
      <Text style={{ color: colors.muted }}>区域（如 eastasia / southeastasia）</Text>
      <TextInput accessibilityLabel="Azure 区域" value={settings.azureRegion} onChangeText={azureRegion => update({ azureRegion })} autoCapitalize="none" autoCorrect={false} style={input} />
      <Text style={{ color: colors.muted }}>风格（可选，如 gentle / cheerful；留空则不加）</Text>
      <TextInput accessibilityLabel="Azure 风格" value={settings.azureStyle} onChangeText={azureStyle => update({ azureStyle })} autoCapitalize="none" autoCorrect={false} style={input} />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 20 }}>中文音色 zh-CN-XiaoyiNeural，英文 en-US-AndrewMultilingualNeural。免费层每月约 50 万字符。</Text>
    </> : null}
    {settings.speechProvider === 'edge' ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 20 }}>免费、无需密钥，但该接口在国内网络常被阻断；连不上会自动回落。</Text> : null}
    {busy ? <ActivityIndicator color={colors.accent} /> : null}
  </Panel>;
}