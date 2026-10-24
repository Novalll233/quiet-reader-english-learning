import {useEffect,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {useSQLiteContext} from 'expo-sqlite';
import * as Clipboard from 'expo-clipboard';
import {Bookmark,Languages,MoreHorizontal,Copy,X} from 'lucide-react-native';
import {IconButton} from '../../components/IconButton';
import type {AIRequest} from '../../services/ai/provider';
import {saveSentence} from '../../services/vocabulary/sentences';
import {SpeechButton} from '../speech/SpeechButton';
import {useSettings} from '../settings/SettingsProvider';

/** Actions retain their selection snapshot; changing the DOM must not lose it. */
export function SentenceActions({bookId,selection,onTranslate,onMore,onClose,translation}:{bookId:string;selection:AIRequest;onTranslate?:()=>void;onMore:()=>void;onClose?:()=>void;translation?:string}){
 const db=useSQLiteContext(),{colors}=useSettings();
 const [saved,setSaved]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const lock=useRef(false),epoch=useRef(0);
 const identity=JSON.stringify([bookId,selection.sectionKey,selection.startOffset,selection.endOffset,selection.targetText]);
 useEffect(()=>{if(!translation||!saved)return;void db.runAsync('UPDATE saved_sentences SET translation=? WHERE book_id=? AND text=?',translation,bookId,selection.targetText.trim()).catch(()=>setMessage('译文保存失败'));},[translation,saved,identity,db]);
 useEffect(()=>{const generation=++epoch.current;setSaved(false);setMessage('');
  void db.getFirstAsync('SELECT 1 FROM saved_sentences WHERE book_id=? AND text=?',bookId,selection.targetText.trim()).then(save=>{if(epoch.current===generation)setSaved(Boolean(save));}).catch(()=>{if(epoch.current===generation)setMessage('状态读取失败');});
  return()=>{epoch.current++;};
 },[identity,db]);
 async function act(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);const generation=epoch.current;try{await action();}catch{if(generation===epoch.current)setMessage('操作失败，请重试');}finally{lock.current=false;setBusy(false);}}
 async function collect(){if(saved)await db.runAsync('DELETE FROM saved_sentences WHERE book_id=? AND text=?',bookId,selection.targetText.trim());else await saveSentence(db,bookId,selection.targetText,selection.paragraphText??selection.targetText);setSaved(!saved);}
 return <View>{translation?.trim()?<View style={{padding:10,marginBottom:8,borderLeftWidth:2,borderLeftColor:colors.accent,backgroundColor:colors.surface,borderRadius:8}}><Text selectable style={{color:colors.text,lineHeight:23}}>{translation.trim()}</Text></View>:null}<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
  <SpeechButton text={selection.targetText}/>
  <IconButton icon={Bookmark} label={saved?'取消收藏':'收藏句子'} selected={saved} disabled={busy} onPress={()=>void act(collect)}/>
  {onTranslate?<IconButton icon={Languages} label="翻译句子" onPress={onTranslate}/>:null}
  <IconButton icon={Copy} label="复制原句" onPress={()=>void act(async()=>{await Clipboard.setStringAsync(selection.targetText);setMessage('已复制');})}/>
  <IconButton icon={MoreHorizontal} label="笔记与标记样式" onPress={onMore}/>
  {onClose?<IconButton icon={X} label="关闭选区" onPress={onClose}/>:null}
 </View>{message?<Text accessibilityLiveRegion="polite" style={{color:colors.muted,fontSize:12}}>{message}</Text>:null}</View>;
}
