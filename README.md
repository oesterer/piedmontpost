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
