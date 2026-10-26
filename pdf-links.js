// Direct source-PDF links need no hosted PDF copies or page images.
export function sourcePdfLink(record) {
 const source = record.sourceUrl || (/^https?:\/\//i.test(record.file || '') ? record.file : null);
 if (!source) return null;
 const url = new URL(source);
 if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported PDF URL');
 const number = Number(record.page || 1);
 const page = Number.isInteger(number) && number > 0 ? number : 1;
 url.searchParams.set('page', String(page));
 // PDF page navigation is a fragment convention, not a standard HTTP query.
 // Include both the requested query parameter and the viewer-compatible fragment.
 const fragment = new URLSearchParams(url.hash.slice(1));
 fragment.set('page', String(page));
 url.hash = fragment.toString();
 return url.href;
}
