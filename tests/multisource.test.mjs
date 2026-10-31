import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../src/search.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const config = { enabled: true, provider: 'auto', customUrl: '', lrcapiUrl: '', lrcapiAuth: '' };
const metadata = ['成龙-明明白白我的心.flac', '惠普正版车载音乐', 'WX:HPshengbangkai', 297];
function fixture(handler) {
  const calls = [], cancelled = [];
  const context = { exports: {}, URLSearchParams, Error, Uint8Array, decodeURIComponent, encodeURIComponent,
    songloft: { net: { httpStream(url, options) {
      calls.push({ url, options });
      let sent = false;
      const value = Promise.resolve().then(() => handler(url, options));
      return {
        response: value.then(v => ({ status: v.status ?? 200 })),
        async read() { const v = await value; if (sent) return null; sent = true; return new TextEncoder().encode(JSON.stringify(v.data)); },
        async cancel() { cancelled.push(url); },
      };
    } } },
  };
  vm.runInNewContext(code, context);
  return { ...context.exports, calls, cancelled };
}
test('cleans track numbers, audio extension, promotional tags and artist/title filename', () => {
  const f = fixture(() => ({}));
  assert.deepEqual(JSON.parse(JSON.stringify(f.normalizeMetadata(...metadata))), { title: '明明白白我的心', artist: '成龙', album: '', duration: 297 });
  assert.equal(f.normalizeMetadata('07.Arnica Montana _ Sea, Sand And Sun.wav', '', '', 449).artist, 'Arnica Montana');
  assert.equal(f.normalizeMetadata('01.A-B.flac', 'Real Artist', '', 200).title, 'A-B');
});
test('QQ returns Chinese LRC and translation, with bounded and cancelled streams', async () => {
  const f = fixture((url, opts) => url.includes('musicu') ? { data: { code: 0, search: { code: 0, data: { body: { item_song: { items: [{ mid: 'mid1', name: '明明白白我的心', singer: [{ name: '成龙' }], interval: 297 }] } } } } } } : { data: { code: 0, lyric: Buffer.from('[00:01.00]明明白白我的心').toString('base64'), trans: '[00:01.00]Translation' } });
  const report = await f.searchAllLyrics({ ...config, provider: 'qqmusic' }, ...metadata);
  assert.equal(report.result.source, 'qqmusic');
  assert.match(report.result.lyric, /明明白白我的心/);
  assert.equal(report.result.tlyric, '[00:01.00]Translation');
  assert.equal(JSON.parse(f.calls[0].options.body).search.param.query, '成龙 明明白白我的心');
  assert.equal(f.calls.length, f.cancelled.length);
  assert.equal(f.calls[0].options.timeoutMs, 3000);
});
test('an unavailable QQ and LRCLIB do not prevent a matching NetEase result', async () => {
  const f = fixture(url => {
    if (url.includes('musicu')) return { data: { code: 0, search: { code: 2001 } } };
    if (url.includes('lrclib')) return { status: 503, data: {} };
    if (url.includes('/api/search')) return { data: { code: 200, result: { songs: [{ id: 1, name: '明明白白我的心', artists: [{ name: '成龙' }], duration: 297000 }] } } };
    return { data: { code: 200, lrc: { lyric: '[00:01.00]网易歌词' } } };
  });
  const report = await f.searchAllLyrics(config, ...metadata);
  assert.equal(report.result.source, 'netease');
  assert.match(f.diagnosticMessage(report), /2001/);
  assert.match(f.diagnosticMessage(report), /HTTP 503/);
});
test('wrong artists and different live versions are rejected instead of borrowing unrelated lyrics', async () => {
  const f = fixture(() => ({ data: { code: 200, result: { songs: [
    { id: 1, name: '明明白白我的心', artists: [{ name: '其他歌手' }], duration: 297000 },
    { id: 2, name: '明明白白我的心 (Live)', artists: [{ name: '成龙' }], duration: 297000 },
  ] } } }));
  const report = await f.searchAllLyrics({ ...config, provider: 'netease' }, ...metadata);
  assert.equal(report.result, null);
  assert.equal(report.diagnostics[0].status, 'not_found');
  assert.equal(f.calls.length, 2);
});
test('failures distinguish malformed data, HTTP errors and timeouts, without leaking upstream secrets', async () => {
  const f = fixture(url => {
    if (url.includes('musicu')) throw new Error('context deadline exceeded token=PRIVATE');
    if (url.includes('163.com')) return { data: { code: 200 } };
    return { status: 503, data: {} };
  });
  const report = await f.searchAllLyrics(config, ...metadata);
  const detail = f.diagnosticMessage(report);
  assert.match(detail, /QQ音乐：请求超时/);
  assert.match(detail, /网易云：搜索响应缺少歌曲列表/);
  assert.match(detail, /LRCLIB：HTTP 503/);
  assert.doesNotMatch(detail, /PRIVATE|token=/);
});
test('identical concurrent requests share work and release the in-flight entry afterwards', async () => {
  const f = fixture(() => ({ status: 503, data: {} }));
  const first = f.searchAllLyrics(config, ...metadata);
  assert.equal(first, f.searchAllLyrics(config, ...metadata));
  await first;
  assert.equal(f.calls.length, 3);
  await f.searchAllLyrics(config, ...metadata);
  assert.equal(f.calls.length, 6);
});
