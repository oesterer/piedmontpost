export const normalize = text => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function searchPages(pages, query, {issue='',mode='words',sort='relevance'}={}) {
 const terms = mode === 'phrase' ? [normalize(query.trim())] : [...new Set(normalize(query).match(/[\p{L}\p{N}]+/gu) || [])];
 if (!terms.length || !terms[0]) return [];
 const matches = [];
 for (const page of pages) {
  if (issue && page.date !== issue) continue;
  const text = normalize(page.text);
  const articles = (page.articles || []).map(article => ({...article, searchable: normalize(article.title + ' ' + article.text)})).filter(article => terms.every(term => article.searchable.includes(term)));
  if (!terms.every(term => text.includes(term)) && !articles.length) continue;
  articles.sort((a,b) => terms.reduce((sum,term) => sum + b.searchable.split(term).length - a.searchable.split(term).length,0));
  const score = terms.reduce((sum,term) => sum + Math.min(text.split(term).length - 1, 20),0);
  matches.push({...page, score, terms, title: articles.map(article => article.title).join(' · '), titleSource: articles.some(article => article.source === 'detected') ? 'detected' : 'reviewed', excerptText: articles.length ? articles[0].title + '. ' + articles[0].text : page.text});
 }
 return matches.sort((a,b) => (sort === 'relevance' ? b.score-a.score : 0) || (sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) || a.page-b.page);
}
export function snippet(text, terms) {
 const lower = normalize(text);
 const positions = terms.map(t=>lower.indexOf(t)).filter(p=>p>=0);
 const first = positions.length ? Math.min(...positions) : 0;
 let start = Math.max(0, first-90);
 if(start>0){const space=text.indexOf(' ',start);if(space>=0&&space<first)start=space+1;}
 const end = Math.min(text.length,start+330);
 return (start?'… ':'')+text.slice(start,end)+(end<text.length?' …':'');
}
