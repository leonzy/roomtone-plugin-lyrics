/// <reference types="@songloft/plugin-sdk" />
import { createRouter, jsonResponse, parseQuery } from '@songloft/plugin-sdk';
import type { HTTPRequest } from '@songloft/plugin-sdk';
import { searchAllLyrics, diagnosticMessage } from './search';
import { loadConfig, saveConfig, DEFAULT_CONFIG, type LyricsConfig } from './config';

const router = createRouter();

let registered = false;

function parseBody(req: HTTPRequest): any {
  if (!req.body) return {};
  const str = typeof req.body === 'string'
    ? req.body
    : String.fromCharCode.apply(null, Array.from(req.body as Uint8Array));
  return JSON.parse(str);
}

async function applyConfig(cfg: LyricsConfig): Promise<void> {
  if (cfg.enabled && !registered) {
    songloft.lyrics.registerProvider();
    registered = true;
    songloft.log.info('[lyrics] 歌词提供者已注册');
  } else if (!cfg.enabled && registered) {
    songloft.lyrics.unregisterProvider();
    registered = false;
    songloft.log.info('[lyrics] 歌词提供者已取消注册');
  }
}

// 后端 InvokeHTTP 调用此端点
router.get('/lyric-search', async (req: HTTPRequest) => {
  const cfg = await loadConfig();
  if (!cfg.enabled) {
    return jsonResponse({ error: 'lyrics search disabled' }, 503);
  }

  // 宿主 url.Values.Encode 使用 + 表示空格；SDK 2.6 只做百分号解码。
  // 先还原表单编码的空格，保留 %2B 表示的真实加号。
  const q = parseQuery(req.query.replace(/\+/g, '%20'));
  const title = q.title || '';
  const artist = q.artist || '';
  const album = q.album || '';
  const duration = parseFloat(q.duration) || 0;

  const report = await searchAllLyrics(cfg, title, artist, album, duration);
  if (!report.result) {
    return jsonResponse({ error: '歌词获取失败', detail: diagnosticMessage(report), diagnostics: report.diagnostics, query: report.query }, report.diagnostics.some(d => d.status === 'error') ? 502 : 404);
  }
  return jsonResponse({ ...report.result, diagnostics: report.diagnostics });
});

router.get('/config', async () => {
  return jsonResponse(await loadConfig());
});

router.put('/config', async (req: HTTPRequest) => {
  const updates = parseBody(req);
  const current = await loadConfig();
  const merged: LyricsConfig = { ...current, ...updates };

  // 校验
  if (!['auto', 'qqmusic', 'netease', 'lrclib', 'lrcapi', 'custom'].includes(merged.provider)) {
    return jsonResponse({ error: '不支持的歌词来源' }, 400);
  }
  if (merged.provider === 'custom' && !merged.customUrl) {
    return jsonResponse({ error: 'custom provider 必须提供 customUrl' }, 400);
  }
  if (merged.provider === 'lrcapi' && !merged.lrcapiUrl) {
    return jsonResponse({ error: 'lrcapi provider 必须提供 lrcapiUrl' }, 400);
  }
  if (merged.provider === 'lrclib') {
    merged.customUrl = '';
  }

  await saveConfig(merged);
  await applyConfig(merged);
  return jsonResponse({ status: 'ok', config: merged });
});

// 测试搜索（用于配置页面验证）
router.get('/test-search', async (req: HTTPRequest) => {
  const cfg = await loadConfig();
  const q = parseQuery(req.query.replace(/\+/g, '%20'));
  const title = q.title || 'Bohemian Rhapsody';
  const artist = q.artist || 'Queen';
  const report = await searchAllLyrics(cfg, title, artist, '', Number(q.duration) || 0);
  return jsonResponse({
    success: !!report.result,
    preview: report.result?.lyric ?? null,
    detail: diagnosticMessage(report),
    diagnostics: report.diagnostics,
    query: report.query,
  });
});

router.get('/', () => ({
  statusCode: 302,
  headers: { Location: 'static/index.html' },
  body: '',
}));

async function onInit(): Promise<void> {
  let cfg = await loadConfig();
  if (!cfg || typeof cfg.enabled === 'undefined') {
    cfg = { ...DEFAULT_CONFIG };
    await saveConfig(cfg);
  }
  await applyConfig(cfg);
}

async function onDeinit(): Promise<void> {
  if (registered) {
    songloft.lyrics.unregisterProvider();
    registered = false;
  }
}

globalThis.onInit = onInit;
globalThis.onDeinit = onDeinit;
globalThis.onHTTPRequest = (req: HTTPRequest) => router.handle(req);
