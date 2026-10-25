# Piedmont Post progressive archive search

This folder contains the current, self-contained implementation. It includes the search website, generated mixed-size indexes, PDF extraction/download scripts, a copy of the successful per-issue cache, configuration, and tests. Nothing outside this folder is needed. Earlier prototypes and their duplicate data have been removed.

## Try the search page

From this folder:

```sh
npm run serve
```

Open **http://localhost:8000**. Or use another port:

```sh
python3 -m http.server 8001 --directory public
```

Open http://localhost:8001. Opening `public/index.html` directly from the filesystem will not work: the browser needs HTTP/HTTPS for modules, Workers and JSON fetching. Previewing the website requires only Python 3; Node dependencies are needed for maintenance and tests.

## Included archive

The copied cache currently contains **315 issues / 10,124 pages**, from 2020 through October 14, 2026. Published files are:

- **24 quarterly indexes**, through **Q2 2026 inclusive** (June 30).
- **15 individual weekly indexes**, from July 1, 2026 onward.
- `public/manifest.json`, listing every index, date range, size, hash and issue.

Every PDF and page appears in exactly one published index. The original PDFs remain on the newspaper's website. The local per-PDF cache is kept separately so regrouping indexes never needs PDF downloads or extraction.

The cutoff is configured in `settings.json`:

```json
{
  "quarterThrough": "2026-06-30",
  "batchSize": 20,
  "memoryCacheBytes": 16777216
}
```

Change `quarterThrough` to a later quarter end if you later want to consolidate more weekly files, then run `npm run publish:indexes`.

## Search behavior

- Startup fetches the small manifest and **only the latest weekly index**.
- Text parsing and searches run in a module Web Worker, separate from the page UI.
- Results are newest first by default; oldest first is also available. There is no claim of global relevance ranking before the entire archive is searched.
- Results appear as each index is searched. After **20 matching pages**, searching pauses without requesting another index unnecessarily. “Show 20 more results” resumes the saved position, including matches remaining in the same file.
- Year and issue filters skip unrelated index files. The issue selector and browsing cards use manifest metadata and do not download historical full-text indexes.
- Search counts say “found so far” until the selected archive has been exhausted. Rare/no-match searches can traverse every relevant index; Stop/Continue is provided.
- Downloads that fail leave the cursor at the failed file. Retry preserves results already displayed and does not silently skip an archive range.
- The latest file stays in the Worker cache; older files use a bounded LRU cache (at most four files and a target of 16 MiB measured by raw JSON bytes). Actual parsed memory is larger than raw bytes. A single oversized file can exceed that byte target.
- New searches cancel outstanding query downloads and ignore obsolete responses. Content-hashed URLs also allow reuse through the browser HTTP cache.
- Results open the source PDF in a new tab using `?page=N#page=N`; actual page navigation depends on the PDF viewer. Headline detection remains approximate.

## Automatic weekly updates

For staff without local development tools, use the scheduled/manual GitHub Actions job. See [AUTOMATION.md](AUTOMATION.md) for the one-time GitHub secret, GitHub Pages setup, schedules, and recovery instructions. The incremental cache is tracked in Git; temporary and compiled files remain ignored.

## Weekly maintenance

Requires macOS with Swift/PDFKit (Xcode Command Line Tools) and Node.js 20+. Install dependencies once:

```sh
npm ci
```

Use installed Chrome to log into the archive, index only new PDFs, then automatically regenerate the mixed quarterly/weekly publication:

```sh
npm run index:archive -- --browser-channel chrome
```

Enter the archive password at the hidden prompt, or supply `PIEDMONT_ARCHIVE_PASSWORD` through your scheduler's secret/environment configuration. The password is not stored in this folder or website.

Alternatively install Playwright's browser once (`npx playwright install chromium`) and run `npm run index:archive` without the channel option. `--headed` opens a visible browser for login diagnostics. `--links /path/to/links.json` supports an explicit PDF link list when discovery needs adapting.

Existing behavior is preserved: PDF downloads have a 10-second timeout and two retries; program/parade links are ignored; failed issues are retried on the next normal run; malformed PDFKit Unicode is repaired before JSON output. No PDF copies or page images are published.

Keep the **entire `cache/` directory**, especially `manifest.json` and `issues/`. It is already populated from the successful old cache. Compiled Swift/browser caches are regenerated as needed; they were deliberately not copied. No old `node_modules` installation or older prototype is required. Never run two updates concurrently; `cache/indexer.lock` prevents this.

To regroup or republish the existing cache without logging in or downloading PDFs:

```sh
npm run publish:indexes
```

`--rebuild` on the archive indexer re-extracts discovered PDFs; it is unnecessary for republishing cached data or retrying previously failed issues. Both normal and rebuild runs retire an unlisted cached URL when a current dated link for the same issue date has been successfully indexed or validated in cache. The old cache JSON is retained for recovery, but excluded from publication. Missing issue dates and failed replacements are preserved; two same-date PDFs that are both currently listed remain separate.

## Deploy

Publish **only `public/`**. Do not upload the maintenance scripts, Node dependencies or cache. It is an ordinary static website: no backend or build step is needed at runtime.

Deploy index files and site assets **before `manifest.json`**. The publisher writes the manifest last locally; use the same order or an atomic release on your host.

Index filenames include a content hash. Existing hashed files are left untouched when their content has not changed. Old file generations are retained so existing visitors can finish searching with an older manifest. Do not immediately remove old generations when updating a live site; prune them later according to your deployment retention policy.

Configure the host to revalidate `manifest.json` and the HTML/JS/CSS, and allow long-lived caching of `indexes/*`. Enable HTTP gzip/Brotli compression. Matching `.gz` and `.br` files are included for hosts that support precompressed static files; these sidecars are optional. The browser fetches the `.json` URL, so sidecars must be served by the host with the correct `Content-Encoding` and `Vary: Accept-Encoding`. Merely uploading sidecars does not enable compression. Python's preview server serves uncompressed JSON.

The first manifest is about 114 KB and newest index 297 KB uncompressed (about 68 KB gzipped). Largest quarterly file is about 5.2 MB uncompressed; the full archive is no longer a single initial download. A search that traverses all years can still download the full archive over time.

## Validation

```sh
npm test
npm run verify:indexes
```

Tests cover incremental download/cache behavior, retries, non-issue filtering, quarter boundaries, stable publication hashes, compression, duplicate protection, progressive batches, streaming, year/issue filters, cancellation/retry, cache eviction, the actual Worker message protocol on real archive data, and search UI interactions in a DOM environment.

`verify:indexes` checks every published page against the copied cache, validates hashes/counts/date ranges, and detects missing or duplicate issues/pages. A visual Chrome smoke test could not run in the build environment because browser launch was blocked; the real Worker and DOM interaction tests passed. Preview in your normal browser before deployment.
