# Piedmont Post archive search

This repository contains the public, static search website and generated indexes. Search runs entirely in the browser; no backend is required.

Live URL after the root migration: **https://oesterer.github.io/piedmontpost/**

The old `/archive-search/public/` path is no longer used. Update the link or iframe in Wix when deploying this version.

## Preview

From this repository:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Use HTTP/HTTPS rather than opening `index.html` directly, since module Workers and JSON fetching require a web origin.

## Deployment

In GitHub **Settings → Pages**, select **GitHub Actions** as the source. The `Deploy search website` workflow publishes on pushes to `main` affecting the website or index files, and can also be run manually. It uploads only website assets and `indexes/`, never repository metadata or maintenance files.

This repository needs no archive password or cross-repository token. Disable/remove the old `Update newspaper search` workflow here; it now belongs in the indexing repository. The default `github-pages` environment should permit the default branch; leave reviewer approval off if unattended deployments are desired.

## Weekly updates

The separate **[piedmontpost_indexing](https://github.com/oesterer/piedmontpost_indexing)** repository owns the downloader, PDF extractor, cache, settings, tests, and scheduled indexing workflow. It pushes only updated `manifest.json` and `indexes/` into this repository. Those pushes trigger this repository's Pages deployment.

Staff continue publishing weekly PDF links in Wix. For immediate indexing, use **Actions → Update newspaper search → Run workflow** in the indexing repository. For a failed Pages deployment, rerun **Deploy search website** here without reindexing PDFs.

Completed calendar quarters are consolidated automatically; the current quarter stays weekly. The calculated cutoff uses America/Los_Angeles and is recorded in the generated manifest for diagnostics.

The old maintenance/cache files remain in this repository's Git history unless separately removed with a history rewrite. No history rewrite is part of this migration.

Published indexes are JSON only. Precompressed `.gz`/`.br` sidecar files are not needed or generated.
