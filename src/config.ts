/// <reference types="@songloft/plugin-sdk" />

const CONFIG_KEY = 'lyrics_config';

export interface LyricsConfig {
  enabled: boolean;
  provider: 'auto' | 'qqmusic' | 'netease' | 'lrclib' | 'lrcapi' | 'custom';
  customUrl: string;
  lrcapiUrl: string;
  lrcapiAuth: string;
}

export const DEFAULT_CONFIG: LyricsConfig = {
  enabled: false,
  provider: 'auto',
  customUrl: '',
  lrcapiUrl: '',
  lrcapiAuth: '',
};

export async function loadConfig(): Promise<LyricsConfig> {
  try {
    const raw = await songloft.storage.get(CONFIG_KEY);
    if (raw && typeof raw === 'object') return { ...DEFAULT_CONFIG, ...(raw as Partial<LyricsConfig>) };
    if (typeof raw === 'string') return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

export async function saveConfig(cfg: LyricsConfig): Promise<void> {
  await songloft.storage.set(CONFIG_KEY, JSON.stringify(cfg));
}
