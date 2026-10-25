export type ThemeName = 'white' | 'paper' | 'dark';
export type ReadingMode = 'swipe' | 'tap' | 'scroll';
/** Preferred read-aloud source; the reader falls back down the remaining ones. */
export type SpeechProvider = 'local' | 'azure' | 'edge' | 'system';
export type ReaderSettings = {
  theme: ThemeName; fontSize: number; lineHeight: number; margin: number; readingMode: ReadingMode;
  pageAnimation: boolean; volumePageTurn: boolean; paragraphTranslation: boolean;
  speechProvider: SpeechProvider; speechLocalUrl: string; speechLocalRef: string; speechLocalPrompt: string;
  speechLocalPromptLang: string; azureRegion: string; azureStyle: string;
};
export type Book = {
  id: string; title: string; format: 'txt' | 'epub'; file_name: string;
  created_at: number; last_read_at: number | null; page_count: number;
  progress: number; page_index: number; scroll_fraction: number; epub_location: string | null;
};
export type BookPage = { page_index: number; text: string; heading: string | null };