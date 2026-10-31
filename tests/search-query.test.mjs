import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const sdk = require('@songloft/plugin-sdk');
const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;

for (const provider of ['lrclib', 'lrcapi']) {
  for (const path of ['/lyric-search', '/test-search']) {
    test(`${provider} ${path} decodes form spaces while preserving literal plus signs`, async () => {
      const calls = [];
      const context = {
        exports: {},
        require: name => {
          if (name === '@songloft/plugin-sdk') return sdk;
          if (name === './config') return { loadConfig: async () => ({ enabled: true, provider }) };
          if (name === './search') return {
            searchAllLyrics: async (...args) => { calls.push({ module: name, args }); return { result: { lyric: '[00:01]found' }, diagnostics: [], query: {} }; },
            diagnosticMessage: () => '',
          };
          throw new Error(`unexpected module ${name}`);
        },
      };
      vm.runInNewContext(js, context);
      // URLSearchParams has the same form encoding as the host's Go url.Values.Encode.
      const metadata = { title: '夜 空 + Live', artist: 'A+B & C D', album: 'An Album / 专辑', duration: '180.5' };
      const result = await context.onHTTPRequest({ method: 'GET', path, query: new URLSearchParams(metadata).toString() });
      assert.equal(result.statusCode, 200);
      assert.equal(calls[0].module, './search');
      assert.equal(calls[0].args[1], metadata.title);
      assert.equal(calls[0].args[2], metadata.artist);
      if (path === '/lyric-search') {
        assert.equal(calls[0].args[3], metadata.album);
        assert.equal(calls[0].args[4], 180.5);
      }
    });
  }
}
