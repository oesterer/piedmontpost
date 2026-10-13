# Piedmont Post static archive prototype

A buildless website searching all 116 pages from the four supplied issues. Upload the contents of `dist/` to a static host; no runtime server, database, external CDN, or API is required.

## Preview locally

From this directory:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Use HTTP rather than opening index.html directly: the app loads its search index with fetch.

## Features

- All-word or exact-phrase search, issue filters, relevance/date sorting, matching excerpts, shareable search URLs.
- Results open a page-specific reader displaying a rendered image of the original PDF page, with previous/next and page-number navigation.
- Links also open the original PDF with `#page=N`. Browser support for PDF fragment navigation varies; the static page reader always selects the requested page.
- Original issue downloads and extracted text for accessibility.

## Adding issues

Put PDFs named `MM-DD-YY ... .pdf` in the project root. On macOS with Swift/PDFKit, regenerate both text and page images:

```sh
mkdir -p dist/issues
swift scripts/index-pdfs.swift
swift scripts/render-pages.swift
```

Then redeploy `dist/`. The static website itself works on any platform; only these prototype preprocessing scripts require macOS. A production cross-platform pipeline could use Poppler or PyMuPDF. Scanned issues need OCR first. Deleted issues also need their obsolete PDF/image files removed from the deployment folder. Update the sample collection labels when expanding beyond these four issues.

## Member access

This local prototype contains no membership system. Browser search downloads the full text index. To keep content private, the hosting layer must enforce authentication on **every asset**, including JSON, page images, and PDFs. Use a host/CDN access gateway or integrate with the existing membership system through authenticated delivery. A JavaScript password prompt does not protect these files. Sites private publication, when deployed, restricts the demo to its owner; it does not implement newspaper subscriber accounts.

## Limits

Matching uses normalized substrings, not linguistic stemming or typo tolerance. All-word matches can come from different articles on the same page; phrase search helps narrow results. Excerpts follow PDF extraction order, which may cross columns. Ads, captions, and repeated headers are included. Search highlights appear in result snippets, not on the page image. The entire 0.7 MB text index is fetched once; larger archives should be split by year or use server-side search. Page previews are JPEGs; original PDFs preserve vector quality and selectable text.

## PDF-to-HTML article proof of concept

Open `dist/articles/2026-10-07/index.html` directly in a browser, or visit `/articles/2026-10-07/` on the local preview server. The PDF archive also links to it. This edition contains 66 HTML pages for articles, letters, columns, notices, and schedules, plus an issue index and conversion notes. The article collection works without a server or external dependencies; source-page comparison links use the existing HTTP-based reader.

The source wording is retained; this is a draft conversion requiring editorial review. Story boundaries and reading order were mapped manually for this one issue. Article continuations are merged. Schedules and the candidate scorecard are HTML tables, and 16 selected photo/illustration crops are rendered from the PDF. Display advertisements, classifieds, cartoons, and the masthead remain in the original issue. The branded real estate report is labeled as a commercial feature.

Rebuild from the retained layout and reviewed map:

```sh
python3 scripts/build-articles.py
swift scripts/render-article-images.swift
```

To re-extract layout on macOS (PDFKit currently emits verbose diagnostic output):

```sh
swift scripts/extract-layout.swift "10-07-26 Post - Web.pdf" 2>/tmp/piedmont-layout.log
```

Provenance and review inputs: `work/article-extraction/layout.json`, `article-map.json`, and `report.json`. This is not a generic automatic splitter: a different issue requires a new reviewed article map. Generation includes no AI rewriting or invented article body text. A few corrupted PDF text spans and table structures were manually transcribed; see the conversion notes.

## Article titles in PDF search results

The PDF indexer reads the reviewed article report and layout in `work/article-extraction/` and attaches page-specific article titles/text to the matching issue. Search results show the titles of articles matching the query and use an excerpt from the best matching article, while preserving the PDF page link. October 7 currently has this metadata, including continuation pages. Unmapped issues now use automatic headline detection; matches spread across separate articles on a page also retain the page label rather than assigning a misleading title. Rebuild the article report before rerunning `scripts/index-pdfs.swift` if article boundaries or titles change.

## Automatic PDF headline detection

The same weekly command, `swift scripts/index-pdfs.swift`, now detects likely article titles from embedded PDF text, relative font sizes, multiline heading alignment, and body-column positions. No article map is needed for a new issue. It filters obvious mastheads/section labels and short display slogans, then associates nearby body text with each headline for search. Results label inferred titles as “Detected headline”; reviewed article mappings take precedence when available. `work/headline-review.json` lists the resulting titles by issue and page for inspection.

This is a layout heuristic, not a guarantee for arbitrary PDFs. It works best on newspaper layouts similar to these samples. Ads can look like articles, captions can be misassigned, and continuation pages may show a shortened title rather than the original headline. Pages without a confident match retain their page label. Image-only scans need OCR that preserves font/layout information, or a separate OCR-aware headline detector; plain OCR text alone is insufficient for this font-based method. Filenames still follow the existing `MM-DD-YY ... .pdf` convention.
