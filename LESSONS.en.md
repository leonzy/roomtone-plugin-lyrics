# Development lessons

## LYR-002: Verify real provider shapes, errors and metadata together

On 2026-10-31 the deployed library searched an artist-prefixed title with promotional artist/album tags; LRCLIB failures were swallowed as 404. Automatic mode now normalizes metadata, concurrently queries QQ/NetEase/LRCLIB, validates title/artist/version/duration, bounds cancellable requests to 3 seconds and 2 MB, and merges identical work. QQ SearchAdaptor actually returns body.item_song.items; an old body.song.list fixture did not prove compatibility. All 22 plugin tests, types and package hashes pass. Deployed QuickJS returned QQ and NetEase lyrics in about 3 seconds while reporting the LRCLIB failure separately. Host diagnostics forwarding is also required. No audio playback or tag writes were initiated.

## LYR-001: Decode form-encoded spaces in lyric metadata queries

- Scope: `songloft-org/songloft-plugin-lyrics#6`, host lyric searches and configuration-page test searches.
- Evidence: on 2026-10-17, baseline `52f75bb20765fcf65e8b594b59bf8001a3f7bfad` used SDK 2.6's percent-only `parseQuery`. The host's Go `url.Values.Encode` encodes spaces as `+`; actual QuickJS logs showed `Fixture+Artist`. A fixture provider requiring the original artist could not match. All four new regressions failed against the old implementation because titles contained incorrect `+` characters.
- Fix: both search routes replace query-string `+` with `%20` before SDK decoding, preserving `%2B` as a literal plus. Regressions cover lrclib/LrcApi, Chinese, spaces, literal plus signs, `&`, albums, and fractional duration.
- Done right: in this uncommitted worktree, all four regressions and type checking passed. The QuickJS package built and installed on a temporary host. Real HTTP calls with a spaced artist and a strict fixture returned lyrics after nine seconds; a read-only database query confirmed `scraped` caching. Evidence: `/tmp/songloft-lyrics-6/{query-before,query-after,integration}.log` and `integration-result.json`. The old root manifest lacks hashes, so the old CLI's root validate command failed; validating the actual manifest in `dist/_build/` passed, and installation also verified package hashes.
- Not run: the reporter's actual songs, provider connectivity, and physical speaker acceptance. Encoding is not established as the reporter's sole cause. Speaker proxy timeouts, error display, and stale-response handling are recorded in that plugin's repository.
- Seen 1× (2026-10-17). Status: lesson; uncommitted and unreleased.

## REL-001: Manual-to-automatic release migration needs an explicit queue checkpoint and artifact validation

- Scope: migrating lyrics releases to the MIoT commit-by-commit rules, requested on 2026-10-17.
- Evidence: the old v2026.8.4 tag still contains manifest version 2026.8.2, with further code commits afterward. Backfilling from that tag would build historical snapshots without the new checks. The root manifest also lacks hashes, so the old root CLI validate command fails; this must not be mislabeled as a new package build failure or bypassed.
- Fix: seed the queue at pre-migration `52f75bb20765fcf65e8b594b59bf8001a3f7bfad`, without claiming that SHA was published. The first new commit contains all existing code. Reuse MIoT's isolated worktrees, immutable tags, four-part Beijing-date versions, documentation filtering, and failure recovery. `npm run validate` checks `dist/_build` metadata and recomputes entry and static asset hashes.
- Done right: 16 tests cover the queue, migration, and tampering. A clean `npm ci`, real QuickJS build, and local bare remote exercise the default release path. The tag's parent matches the source, metadata is synchronized, and a rerun publishes nothing. Evidence: `/tmp/songloft-lyrics-6/{release-tests,rehearsal}.log` and `rehearsal-result.json`. GitHub Release calls were simulated; the rehearsal made no GitHub writes.
- Validation boundary: actionlint 1.7.12 rejects `concurrency.queue`, so the first lint run failed. After verifying `queue: max` against [GitHub's official concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency), only that outdated diagnostic was excluded; all other checks passed. Actual publication still requires the remote run and package acceptance for the same source commit.
- Seen 1× (2026-10-17). Status: lesson; actual publication is reported against the final commit.
