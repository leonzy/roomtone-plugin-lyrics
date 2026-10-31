import type { LyricsConfig } from './config';

export interface Metadata { title: string; artist: string; album: string; duration: number }
interface Candidate extends Metadata { id: string; lyric?: string; tlyric?: string; rlyric?: string }
interface Payload { lyric: string; tlyric?: string; rlyric?: string; source?: string }
export interface Diagnostic { source: string; status: string; reason: string }
export interface SearchReport { result: Payload | null; diagnostics: Diagnostic[]; query: Metadata }
const labels: Record<string, string> = { qqmusic: 'QQ音乐', netease: '网易云', lrclib: 'LRCLIB', custom: '自定义歌词源', lrcapi: 'LrcApi' };
const promotional = /(?:正版|车载|车用|无损音乐|音乐下载|微信|公众号|WX\s*[:：]|https?:\/\/|www\.)/i;
const compact = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
class NoLyrics extends Error {}

export function normalizeMetadata(title: string, artist: string, album: string, duration: number): Metadata {
  title = title.trim().replace(/\.(?:mp3|flac|wav|ape|m4a|aac|dsf|dff)$/i, '').replace(/^\s*\d{1,3}\s*[.、)）_-]\s*(?!\d)/, '');
  title = title.replace(/[【\[](?:[^\]】]*(?:无损|FLAC|MP3|高音质|车载|www\.|https?:)[^\]】]*)[】\]]/gi, '').trim();
  if (promotional.test(artist) || /^(?:unknown|unknown artist|未知|未知歌手|various artists|群星)$/i.test(artist.trim())) artist = '';
  if (promotional.test(album)) album = '';
  const split = title.match(/^(.{1,60}?)\s*[-－—–]\s*(.+)$/) || title.match(/^(.{1,60}?)\s+_\s+(.+)$/);
  if (split && (!artist.trim() || compact(artist) === compact(split[1]))) {
    artist = split[1].trim(); title = split[2].trim();
  }
  return { title, artist: artist.trim(), album: album.trim(), duration };
}

function decodeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  let text = value;
  if (!/[\[\]\s\u0080-\uffff]/.test(text) && /^[A-Za-z0-9+/]+={0,2}$/.test(text) && text.length >= 16) {
    try {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let bits = 0, count = 0, encoded = '';
      for (const char of text.replace(/=+$/, '')) {
        bits = (bits << 6) | alphabet.indexOf(char); count += 6;
        if (count >= 8) { count -= 8; encoded += '%' + ((bits >> count) & 255).toString(16).padStart(2, '0'); }
      }
      text = decodeURIComponent(encoded);
    } catch { return ''; }
  }
  return text.replace(/&#(x[\da-f]+|\d+);/gi, (_m, n) => String.fromCodePoint(parseInt(n[0].toLowerCase() === 'x' ? n.slice(1) : n, n[0].toLowerCase() === 'x' ? 16 : 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function request(url: string, init: RequestInit = {}): Promise<any> {
  // Use the host's cancellable stream when available. No dangling fetches after
  // a timeout, and response sizes are bounded before parsing provider content.
  const net = (globalThis as any).songloft?.net;
  let text: string;
  let status: number;
  if (net?.httpStream) {
    const stream = net.httpStream(url, { ...init, timeoutMs: 3000 });
    try {
      const response = await stream.response;
      status = response.status;
      let encoded = '', size = 0;
      while (true) {
        const chunk: Uint8Array | null = await stream.read();
        if (!chunk) break;
        size += chunk.length;
        if (size > 2 * 1024 * 1024) throw new Error('响应超过 2 MB 限制');
        for (const byte of chunk) encoded += '%' + byte.toString(16).padStart(2, '0');
      }
      text = decodeURIComponent(encoded);
    } finally { await stream.cancel().catch(() => {}); }
  } else {
    const response = await fetch(url, init); status = response.status; text = await response.text();
  }
  if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
  let data: any;
  try { data = JSON.parse(text.replace(/^\w+\((.*)\);?\s*$/s, '$1')); }
  catch { throw new Error('响应不是有效 JSON'); }
  if (data?.code != null && ![0, 200].includes(Number(data.code))) throw new Error(`业务错误码 ${String(data.code).replace(/[^\w-]/g, '').slice(0, 20)}`);
  return data;
}

function rank(c: Candidate, q: Metadata): number {
  const versions = /live|现场|伴奏|翻唱|remix|karaoke/ig;
  if ((c.title.match(versions) || []).join('').toLowerCase() !== (q.title.match(versions) || []).join('').toLowerCase()) return 0;
  const core = (value: string) => compact(value.replace(/\s*[(（\[【][^()（）\[\]【】]*[)）\]】]\s*$/, ''));
  const a = compact(c.title), b = compact(q.title);
  if (!a || !b || core(c.title) !== core(q.title)) return 0;
  // Without a known artist, accept only an exact title and a close duration.
  if (!q.artist && (a !== b || !q.duration || !c.duration || Math.abs(c.duration - q.duration) > 8)) return 0;
  if (q.artist && (!c.artist || !compact(c.artist).includes(compact(q.artist)))) return 0;
  if (q.duration && c.duration && Math.abs(c.duration - q.duration) > 20) return 0;
  return (a === b ? 1 : 0.75) + (q.duration && c.duration ? Math.max(0, 1 - Math.abs(c.duration - q.duration) / 20) : 0);
}

const headers = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://y.qq.com/' };
async function qqSearch(q: Metadata): Promise<Candidate[]> {
  const data = await request('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comm: { ct: 24, cv: 4747474, uin: 0, format: 'json', platform: 'yqq.json' }, search: {
      module: 'music.adaptor.SearchAdaptor', method: 'do_search_v2',
      param: { query: [q.artist, q.title].filter(Boolean).join(' '), search_type: 0, page_num: 1, num_per_page: 8, highlight: 0 },
    } }),
  });
  if (data.search?.code) throw new Error(`搜索业务错误码 ${Number(data.search.code)}`);
  const list = data.search?.data?.body?.item_song?.items ?? data.search?.data?.body?.song?.list;
  if (!Array.isArray(list)) throw new Error('搜索响应缺少歌曲列表');
  return list.map((s: any) => ({ id: s.mid || s.songmid, title: s.name || s.songname || '', artist: (s.singer || []).map((v: any) => v.name).join(' / '), album: s.album?.name || '', duration: Number(s.interval) || 0 }));
}
async function neteaseSearch(q: Metadata): Promise<Candidate[]> {
  const data = await request('https://music.163.com/api/search/get/web', {
    method: 'POST', headers: { ...headers, Referer: 'https://music.163.com/', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ s: [q.artist, q.title].filter(Boolean).join(' '), type: '1', limit: '8', offset: '0' }).toString(),
  });
  if (!Array.isArray(data.result?.songs)) {
    if (Number(data.result?.songCount) === 0) return [];
    throw new Error('搜索响应缺少歌曲列表');
  }
  return data.result.songs.map((s: any) => ({ id: String(s.id), title: s.name || '', artist: (s.artists || s.ar || []).map((v: any) => v.name).join(' / '), album: (s.album || s.al)?.name || '', duration: Number(s.duration || s.dt) / 1000 || 0 }));
}

async function searchSource(source: string, cfg: LyricsConfig, q: Metadata): Promise<Payload | null> {
  let candidates: Candidate[];
  if (source === 'qqmusic' || source === 'netease') {
    candidates = await (source === 'qqmusic' ? qqSearch(q) : neteaseSearch(q));
    // Relax the search query, not candidate validation.
    if (!candidates.some(c => rank(c, q)) && q.artist) candidates = await (source === 'qqmusic' ? qqSearch({ ...q, artist: '' }) : neteaseSearch({ ...q, artist: '' }));
  } else if (source === 'lrcapi') {
    const data = await request(cfg.lrcapiUrl.replace(/\/+$/, '') + '/jsonapi?' + new URLSearchParams({ title: q.title, artist: q.artist }),
      { headers: cfg.lrcapiAuth ? { Authorization: cfg.lrcapiAuth } : {} });
    if (!Array.isArray(data)) throw new Error('响应缺少歌曲列表');
    candidates = data.map((v: any) => ({ id: String(v.id), title: v.title || '', artist: v.artist || '', album: '', duration: 0, lyric: v.lyrics }));
  } else {
    const base = source === 'custom' ? cfg.customUrl.replace(/\/+$/, '') : 'https://lrclib.net';
    let data: any;
    if (q.artist) {
      try {
        const exact = await request(base + '/api/get?' + new URLSearchParams({ track_name: q.title, artist_name: q.artist, ...(q.album ? { album_name: q.album } : {}), ...(q.duration ? { duration: String(Math.round(q.duration)) } : {}) }));
        if (exact.syncedLyrics || exact.plainLyrics) data = [exact];
      } catch (e) { if (!(e instanceof Error) || e.message !== 'HTTP 404') throw e; }
    }
    if (!data) data = await request(base + '/api/search?' + new URLSearchParams({ track_name: q.title }));
    if (!Array.isArray(data)) throw new Error('响应缺少歌曲列表');
    candidates = data.map((v: any) => ({ id: String(v.id), title: v.trackName || '', artist: v.artistName || '', album: v.albumName || '', duration: Number(v.duration) || 0, lyric: v.syncedLyrics || v.plainLyrics }));
  }
  const ranked = candidates.filter(c => rank(c, q) > 0).sort((a, b) => rank(b, q) - rank(a, q));
  if (!ranked.length) throw new NoLyrics(candidates.length ? '有候选，但歌名、歌手、版本或时长不符' : '搜索未返回匹配歌曲');
  for (const candidate of ranked.slice(0, 2)) {
    let result: Payload;
    if (source === 'qqmusic') {
      const data = await request('https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?' + new URLSearchParams({ songmid: candidate.id, format: 'json', nobase64: '1' }), { headers });
      result = { lyric: decodeText(data.lyric), tlyric: decodeText(data.trans) };
    } else if (source === 'netease') {
      const data = await request('https://music.163.com/api/song/lyric?' + new URLSearchParams({ id: candidate.id, lv: '-1', tv: '-1', rv: '-1' }), { headers: { ...headers, Referer: 'https://music.163.com/' } });
      result = { lyric: data.lrc?.lyric || '', tlyric: data.tlyric?.lyric, rlyric: data.romalrc?.lyric };
    } else result = { lyric: candidate.lyric || '' };
    if (result.lyric.trim()) return { ...result, source };
  }
  throw new NoLyrics('已匹配歌曲，但该版本未提供歌词');
}

const inFlight = new Map<string, Promise<SearchReport>>();
export function searchAllLyrics(cfg: LyricsConfig, title: string, artist: string, album: string, duration: number): Promise<SearchReport> {
  const q = normalizeMetadata(title, artist, album, duration);
  const key = JSON.stringify([cfg, q]);
  const running = inFlight.get(key);
  if (running) return running;
  const work = (async () => {
    const sources = cfg.provider === 'auto' ? ['qqmusic', 'netease', 'lrclib'] : [cfg.provider];
    const outcomes = await Promise.all(sources.map(async source => {
      try {
        const result = q.title ? await searchSource(source, cfg, q) : null;
        return { result, diagnostic: { source, status: result ? 'success' : 'not_found', reason: result ? '已找到歌词' : q.title ? '未找到歌名、歌手和时长相符的歌词' : '缺少有效歌名' } };
      } catch (e) {
        if (e instanceof NoLyrics) return { result: null, diagnostic: { source, status: 'not_found', reason: e.message } };
        const raw = e instanceof Error ? e.message : '';
        const reason = /timeout|deadline|timed out/i.test(raw) ? '请求超时'
          : /permission|权限/i.test(raw) ? '歌词插件缺少网络权限'
          : /max 8 HTTP streams|too many/i.test(raw) ? '并发请求达到上限，请稍后重试'
          : /no such host|lookup|\bdns\b/i.test(raw) ? 'DNS 解析失败'
          : /certificate|x509|\btls\b/i.test(raw) ? 'TLS 证书或握手失败'
          : /connection refused/i.test(raw) ? '连接被拒绝'
          : /\bEOF\b|connection reset|closed connection/i.test(raw) ? '连接被对端关闭'
          : /HTTP \d{3}|业务错误码|响应|搜索/.test(raw) ? raw.slice(0, 120) : '网络连接失败';
        return { result: null, diagnostic: { source, status: 'error', reason } };
      }
    }));
    return { result: outcomes.find(v => v.result)?.result ?? null, diagnostics: outcomes.map(v => v.diagnostic), query: q };
  })();
  inFlight.set(key, work);
  void work.finally(() => inFlight.delete(key));
  return work;
}

export function diagnosticMessage(report: SearchReport): string {
  return report.diagnostics.map(d => `${labels[d.source] || d.source}：${d.reason}`).join('；');
}
