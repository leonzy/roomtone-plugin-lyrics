# Lyrics Search Plugin

Roomtone fork: QQ Music, NetEase and LRCLIB run concurrently, with results preferred in that order. Single-provider and custom endpoints remain available. Filename/track-number/promotional-tag normalization precedes strict title, artist, version and duration validation. Search relaxation does not relax candidate validation. Available translations and romanization are retained.

Automatic adoption requires a trusted artist and complete artist-name matching. Identical titles and close durations do not identify a performer, and an artist-name substring is insufficient. If tags and filenames cannot supply an artist, the plugin asks the user to complete that field instead of guessing.

Failures distinguish HTTP status, provider business codes, timeout, network/format errors and no match. Cancellable host HTTP streams use a 3-second request limit and a 2 MB response cap. Concurrent identical searches share work and release it afterwards. The host must forward provider diagnostics to display detailed errors. Public endpoints require no API key but may impose access restrictions. Based on [the upstream plugin](https://github.com/songloft-org/songloft-plugin-lyrics).

Automatically searches [lrclib.net](https://lrclib.net) or a compatible custom API when a song has no lyrics. The plugin registers as a server-side lyric provider, which the host calls when needed.

## Installation

1. Download [lyrics.jsplugin.zip](../../releases/latest).
2. Place it in Songloft's `data/jsplugins/` directory.
3. Restart Songloft.

## Features

- **Automatic search**: registers as a server-side lyric provider for songs without lyrics.
- **Exact and fuzzy matching**: tries title, artist, album, and duration first, then falls back to fuzzy search.
- **Synced lyrics preferred**: favors results with LRC timestamps.
- **Custom API**: supports a self-hosted lrclib-compatible API.
- **Configuration page**: a web UI for enabling search, configuring providers, and testing searches.

## Usage

### Enable the plugin

Search is **disabled** by default. Open the configuration page, enable lyric search, and save. Enabling search registers the lyric provider with the host; disabling it unregisters the provider.

### Choose a provider

- **lrclib.net** (default): an open lyric database with no registration required.
- **Custom API**: enter an lrclib-compatible API address with `/api/get` for exact lookup and `/api/search` for fuzzy search.

### Test a search

The bottom of the configuration page lets you test connectivity and matching using a song title and artist.

### Smart speaker player page

The smart speaker plugin calls this provider through the host's song lyrics endpoint, so no separate lyric provider configuration is needed there. In addition to enabling the plugin itself, save the lyric search toggle in its settings. Play a library song and open the smart speaker plugin's lyrics page to search automatically; newer speaker plugin versions also provide a button to fetch lyrics again. Spaces in titles, artists, and albums are preserved, as are literal `+` characters.

These lyrics appear on the plugin's web page. Lyrics on a speaker's touchscreen use the smart speaker plugin's separate touchscreen lyrics setting.

### Automatic releases

Pushing to `main` automatically releases each non-documentation commit as `YYYY.M.D.N` using Beijing time, starting each day at `.0`. Markdown-only or `docs/` changes produce no package, and version metadata commits do not trigger recursive releases. Failed runs can resume manually without replacing existing tags or Releases. Each package requires clean dependency installation, type checking, tests, a QuickJS build, and artifact hash validation.

See [Automatic releases](docs/en/releases.md) for the full rules, migration checkpoint, and local verification.

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/lyric-search?title=...&artist=...&album=...&duration=...&fingerprint=...&isrc=...` | Lyric search called through the host's InvokeHTTP; fingerprint and isrc are optional |
| GET | `/config` | Read configuration |
| PUT | `/config` | Update configuration |
| GET | `/test-search?title=...&artist=...` | Test a search |
| GET | `/` | Redirect to the configuration page |

## Development and build

Built with `@songloft/plugin-sdk` and TypeScript, running in the QuickJS sandbox.

```bash
npm install
npm run dev       # watch and upload to local Songloft
npm run build     # produce dist/lyrics.jsplugin.zip
npx tsc --noEmit
node --test tests/*.test.mjs
npm run validate  # check dist/_build manifest and artifact hashes
```

## Requirements

- Songloft v2.6.0+

## License

Apache-2.0
