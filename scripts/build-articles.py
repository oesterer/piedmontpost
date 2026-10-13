#!/usr/bin/env python3
"""Rebuild the reviewed October 7 PDF-to-HTML proof of concept (stdlib only)."""
import json, re, html, hashlib
from collections import Counter, defaultdict
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
MAP = json.loads((ROOT/'work/article-extraction/article-map.json').read_text())
LAYOUT = json.loads((ROOT/'work/article-extraction/layout.json').read_text())
PAGES = {p['page']: {l['id']: l for l in p['lines']} for p in LAYOUT}
OUT = ROOT/'dist/articles'/MAP['issue']
OUT.mkdir(parents=True, exist_ok=True)
E = lambda text: html.escape(str(text), quote=True)
KEEP_HYPHEN = set('well high low full part long short first second third fourth fifth sixth seventh eighth ninth tenth half self close day all one two three four five six seven eight nine ten twenty thirty forty fifty sixty seventy eighty ninety hundred year two-day'.split())
def clean(text):
 return re.sub(r'\s+', ' ', text.replace('\u00ad', '')).strip()
def join_text(lines):
 result=''
 for raw in lines:
  t=clean(raw)
  if not t: continue
  if not result: result=t; continue
  last=result.split()[-1]
  if result.endswith('-') and t[0].isalnum():
   stem=last[:-1].split('-')[-1].lower()
   preserve = stem in KEEP_HYPHEN or t[0].isdigit() or (last[:-1],t.split()[0].rstrip(',.;')) in {('Bostrom','Fleming'),('Chignin','Bergeron'),('Schulte','Sasse')} or ('/' in last or '@' in last)
   if stem in {'high','north','sun','ten','new'} and t.lower().startswith(('land','ern','day','nis','som')): preserve=False
   result=(result if preserve else result[:-1])+t
  elif result.endswith(('/', '@')) or (re.search(r'(https?://|www\.|@)',last) and result.endswith('.')):
   result+=t
  else: result+=' '+t
 return result

def line_text(page, ranges):
 return join_text([PAGES[page][i]['text'] for lo,hi in ranges for i in range(lo,hi+1)])

def selected(article):
 return [(seg['page'],i,PAGES[seg['page']][i]) for seg in article['segments'] for lo,hi in seg['ranges'] for i in range(lo,hi+1)]

def table(headers, rows):
 return '<div class="table-scroll"><table><thead><tr>'+''.join('<th scope="col">'+E(h)+'</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+E(c)+'</td>' for c in row)+'</tr>' for row in rows)+'</tbody></table></div>'

def special_blocks(article):
 kind=article['special']
 if kind=='sweeping-tips':
  return [dict(tag='p',text=line_text(11,[[227,228]])),dict(tag='ol',items=[line_text(11,[[231,231]]),line_text(11,[[232,232]]),line_text(11,[[233,234]]).removeprefix('3. '),line_text(11,[[235,238]]).removeprefix('4. ')])]
 if kind=='street-sweeping':
  b=[dict(tag='p',text=line_text(11,[[2,3]])),dict(tag='h2',text='October 5 - 16'),dict(tag='html',html=table(['Week','Monday','Tuesday','Wednesday','Thursday','Friday'],[['October 5–9','5 · 1-Odd','6 · 2-O','7 · 3-O','8 · 4-O','9 · 5-O'],['October 12–16','12 · 1-Even','13 · 2-E','14 · 3-E','15 · 4-E','16 · 5-E']])),dict(tag='p',text='E = Even Street Numbers. O = Odd Street Numbers.'),dict(tag='p',text=line_text(11,[[125,125]]))]
  for zone,lo,hi in [(1,9,48),(2,49,85),(3,129,175),(4,86,121),(5,178,221)]:
   streets=[]
   for i in range(lo,hi+1):
    t=clean(PAGES[11][i]['text'])
    if t.startswith('(') or (streets and streets[-1].count('(')>streets[-1].count(')')): streets[-1]+=' '+t
    else: streets.append(t)
   b.extend([dict(tag='h2',text='Zone '+str(zone)),dict(tag='ul',items=streets)])
  b.append(dict(tag='p',text=line_text(11,[[222,225]])))
  return b
 if kind=='sports-schedule':
  rows=[['Oct. 7','Wed.','TEN','Justin Sienna (Napa)','A/H','3:30','3:30'],['Oct. 8','Thurs.','VB','Bishop O’Dowd','H','6:30','5:30'],['Oct. 8','Thurs.','FF','Hayward','H','7:30','6:30'],['Oct. 9','Fri.','XC','Asics Clovis Invitational at Woodward Park, Fresno','A','7:45am','----'],['Oct. 9','Fri.','WP-B','Monterey Bay Invitational Tournament vs. Pacific Grove','A','1:00','------'],['Oct. 9','Fri.','FB','Arroyo','H','7:00','4:00'],['Oct. 10','Sat.','WP-B','Monterey Bay Invitational Tournament','A','TBD','------'],['Oct. 13','Tues.','WP-B','Lick-Wilmerding (San Francisco)','A','4:45','3:30'],['Oct. 13','Tues.','FF','San Lorenzo','A','4:15','------'],['Oct. 14','Wed.','GG','Arroyo, Castro Valley at Lake Chabot GC','A','3:30','3:30'],['Oct. 14','Wed.','TEN','Alameda','H/A','3:30','3:30'],['Oct. 14','Wed.','VB','Berkeley','A','6:30','5:30']]
  return [dict(tag='p',text=line_text(13,[[181,181]])),dict(tag='html',html=table(['Date','Day','Sport','Opponent','Location','Varsity','JV'],rows)),dict(tag='p',text='KEY: H = Home · A = Away · FB = Football · FF = Flag Football · WP-B = Boys’ Water Polo · TEN = Girls’ Tennis · XC = Cross Country · VB = Girls’ Volleyball · GG = Girls’ Golf')]
 if kind=='community-calendar':
  return [dict(tag='h2',text=line_text(28,[[58,58]])),dict(tag='html',html=table(['Date','Time','Meeting','Location'],[['Wednesday, October 7','5:30 p.m.','Park Commission meeting','City Hall'],['Monday, October 12','5:30 p.m.','Planning Commission meeting','City Hall'],['Wednesday, October 14','7:00 p.m.','Board of Education meeting','City Hall']])),dict(tag='p',text=line_text(28,[[65,65]]))]
 if kind=='scorecard':
  rows=[]
  for name,ranges in [('Sunny Bostrom-Fleming',[(242,243),(244,247),(248,253),(254,257)]),('Bill Reichle',[(259,263),(264,266),(267,272),(273,278)]),('Nancy Beninati',[(281,285),(286,290),(291,295),(296,301)]),('Adam Hundt',[(304,309),(310,314),(315,321),(322,331)]),('Tom Ramsey (Incumbent)',[(335,338),(339,341),(342,349),(350,357)])]:
   rows.append([name]+[line_text(27,[r]) for r in ranges])
  return [dict(tag='html',html=table(['Candidates','Top 3 issues facing Piedmont','Top 3 infrastructure needs','Moraga Canyon Specific Plan: What would you need to see in it before voting yes?','Do you support the Fire Dept. union’s requests for increased benefits?'],rows)),dict(tag='p',text=line_text(27,[[358,358]]))]
 raise ValueError(kind)

def make_blocks(article):
 if article.get('literalOnly'): return article['literalBlocks']
 if article.get('special'): return special_blocks(article)
 rows=selected(article)
 # Body margins differ between columns and boxed features. Infer each margin
 # from the selected body instead of treating a second column as a new paragraph.
 margins={}
 for page,_,line in rows:
  col=round((line['x']-34)/147)
  margins[(page,col)]=min(margins.get((page,col),1e9),line['x'])
 blocks=[]; pending=[]; previous=None
 headings=article.get('headings',{}); omit=set(article.get('omit',[])); starts=set(article.get('paragraphStarts',[]))
 def flush():
  if pending:
   blocks.append(dict(tag='p',text=join_text(pending)));pending.clear()
 for page,i,line in rows:
  key=f'{page}:{i}'
  if key in omit: continue
  t=clean(line['text'])
  if not t: continue
  if key in headings:
   flush();blocks.append(dict(tag='h2',text=headings[key]));previous=None;continue
  col=round((line['x']-34)/147)
  indent=line['x']-margins[(page,col)]>=8
  gap=previous and previous[0]==page and abs(previous[2]['x']-line['x'])<35 and previous[2]['y']-line['y']>16
  bullet=t=='•'
  # A line starting with a bullet marks a new item; hanging lines continue it.
  same_hanging_indent = previous and previous[0]==page and abs(previous[2]['x']-line['x'])<2 and not gap
  if ((indent and not same_hanging_indent) or gap or bullet or key in starts) and pending and not pending[-1].rstrip().endswith('-'):
   # Do not split hanging bullet items immediately after their bullet.
   if pending[-1]!='•': flush()
  pending.append(t); previous=(page,i,line)
 flush()
 if article.get('appendText'):blocks.append(dict(tag='p',text=article['appendText']))
 # Convert consecutive printed bullet paragraphs into semantic HTML lists.
 grouped=[]
 for block in blocks:
  if block['tag']=='p' and block['text'].startswith('• '):
   if not grouped or grouped[-1]['tag']!='ul': grouped.append(dict(tag='ul',items=[]))
   grouped[-1]['items'].append(block['text'][2:])
  else: grouped.append(block)
 return grouped

def body_html(blocks):
 out=[]
 for block in blocks:
  tag=block['tag']
  if tag=='html':out.append(block['html'])
  elif tag in ('ol','ul'):out.append('<'+tag+'>'+''.join('<li>'+E(t)+'</li>' for t in block['items'])+'</'+tag+'>')
  else: out.append('<'+tag+'>'+E(block['text'])+'</'+tag+'>')
 return '\n'.join(out)

def page_link(page):return '../../reader.html?issue=2026-10-07&amp;page='+str(page)
def source_links(pages):return ' · '.join('<a href="'+page_link(p)+'">Page '+str(p)+'</a>' for p in pages)
def figure(article,index):
 image=article['images'][index];caption=line_text(image['page'],image['captionRanges'])
 return '<figure><img '+('fetchpriority="high"' if index==0 else 'loading="lazy"')+' src="images/'+E(article['slug'])+'-'+str(index+1)+'.jpg" alt="'+E(caption)+'"><figcaption>'+E(caption)+'</figcaption></figure>'
def header(index=False):
 return '<header class="masthead"><div class="edition-line"><span>PIEDMONT, CALIFORNIA</span><span>OCTOBER 7, 2026 · VOL. 28, NO. 50</span></div><a class="brand" href="index.html">Piedmont Post</a><p>A Community Newspaper Serving the Citizens of Piedmont</p><nav><a href="../../index.html">PDF archive</a><a class="active" href="index.html">Read as articles</a><a href="../../issues/2026-10-07.pdf">Original issue ↗</a></nav></header>'
def shell(title,content,description='',extra=''):
 return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+E(title)+' · Piedmont Post</title><meta name="description" content="'+E(description)+'"><link rel="stylesheet" href="article.css">'+extra+'</head><body>'+header()+content+'<footer><strong>Piedmont Post</strong><span>October 7, 2026 · PDF-to-HTML proof of concept</span><a href="conversion-notes.html">Conversion notes</a></footer></body></html>\n'

coverage=defaultdict(list);used={};export=[];cards=[]
for article in MAP['articles']:
 refs=selected(article)
 for p,i,_ in refs:
  key=f'{p}:{i}'
  if key in used:raise ValueError(f'Overlapping article bodies: {key}: {used[key]} / {article["slug"]}')
  used[key]=article['slug']
 pages=list(dict.fromkeys(seg['page'] for seg in article['segments']))
 for p in pages:coverage[p].append(article['slug'])
 blocks=make_blocks(article)
 plain='\n\n'.join(html.unescape(re.sub('<[^>]+>',' ',b['html'])) if b['tag']=='html' else b.get('text',' '.join(b.get('items',[]))) for b in blocks)
 excerpt=next((b['text'] for b in blocks if b.get('tag')=='p'),article['title'])[:220]
 wordcount=len(re.findall(r'\S+',plain));minutes=max(1,round(wordcount/220))
 image=figure(article,0) if article.get('images') else ''
 gallery=''.join(figure(article,i) for i in range(1,len(article.get('images',[]))))
 label='By '+article['author'] if article['author'] else 'Piedmont Post'
 if article['section'] in ('Letters','Opinion'):label=article['author'] or 'Piedmont Post'
 title=article['title'];subtitle='<p class="subtitle">'+E(article['subtitle'])+'</p>' if article.get('subtitle') else ''
 kicker=article.get('kicker',article['section'])
 extra='<script type="application/ld+json">'+json.dumps({'@context':'https://schema.org','@type':'Article','headline':title,'datePublished':'2026-10-07','author':{'@type':'Person','name':article['author']} if article['author'] else {'@type':'Organization','name':'Piedmont Post'},'publisher':{'@type':'Organization','name':'Piedmont Post'},'articleSection':article['section']},ensure_ascii=False).replace('</','<\/')+'</script>'
 content='<main class="article"><a class="back" href="index.html">← All stories in this issue</a><div class="article-heading"><p class="eyebrow">'+E(kicker)+'</p><h1>'+E(title)+'</h1>'+subtitle+'<p class="byline">'+E(label)+' <span>· October 7, 2026 · '+str(minutes)+' min read</span></p></div>'+image+'<div class="article-body">'+body_html(blocks)+'</div>'+gallery+'<aside class="source"><strong>From the printed issue</strong><p>October 7, 2026 · '+source_links(pages)+'</p><p class="small">Proof of concept. Text and paragraph boundaries need editorial review before publication.</p></aside><nav class="article-bottom"><a href="index.html">← Back to all stories</a><a href="'+page_link(pages[0])+'">Compare with the printed page ↗</a></nav></main>'
 (OUT/(article['slug']+'.html')).write_text(shell(title,content,excerpt,extra))
 searchtext=(title+' '+article['author']+' '+plain+' '+re.sub('<[^>]+>',' ',body_html(blocks))).lower()
 card='<article class="story-card" data-section="'+E(article['section'])+'" data-search="'+E(searchtext)+'">'+('<a class="card-image" href="'+E(article['slug'])+'.html"><img loading="lazy" src="images/'+E(article['slug'])+'-1.jpg" alt=""></a>' if article.get('images') else '')+'<p class="eyebrow">'+E(article['section'])+'</p><h3><a href="'+E(article['slug'])+'.html">'+E(title)+'</a></h3><p class="card-excerpt">'+E(excerpt)+('…' if len(excerpt)>=220 else '')+'</p><div class="card-meta">'+E(article['author'] or 'Piedmont Post')+'<span>p. '+', '.join(map(str,pages))+'</span></div></article>'
 cards.append(card)
 export.append(dict(slug=article['slug'],title=title,section=article['section'],author=article['author'],pages=pages,blocks=blocks,sourceLines=[f'{p}:{i}' for p,i,_ in refs],note=article.get('note'),wordCount=wordcount))

sections=list(dict.fromkeys(a['section'] for a in MAP['articles']))
options=''.join('<option>'+E(s)+'</option>' for s in sections)
content='<main class="issue-home"><section class="issue-intro"><p class="eyebrow">THE WEEKLY EDITION · OCTOBER 7, 2026</p><h1>The Post, one story at a time.</h1><p>Read this week’s local news, community voices, sports, and arts as individual articles.</p><div class="prototype-note"><span>PDF-to-HTML proof of concept</span> · '+str(len(cards))+' articles, letters, columns, and notices · Editorial review pending</div></section><section class="article-search"><label for="article-query">Find a story in this issue</label><div><input id="article-query" type="search" placeholder="Search names, headlines, or article text…"><label class="sr-only" for="section-filter">Section</label><select id="section-filter"><option value="">All sections</option>'+options+'</select></div><p id="article-status" role="status" aria-live="polite">'+str(len(cards))+' stories in this edition</p></section><section class="story-grid" aria-label="Stories">'+''.join(cards)+'</section><p id="no-stories" hidden>No matching stories. Try a different name or select all sections.</p><aside class="print-note"><h2>Prefer the printed edition?</h2><p>The original newspaper includes advertisements, cartoons, and the full page layouts.</p><a href="../../reader.html?issue=2026-10-07&amp;page=1">Open the original issue ↗</a></aside></main><script src="issue.js"></script>'
(OUT/'index.html').write_text(shell('October 7 edition',content,'Read the October 7, 2026 Piedmont Post as individual HTML articles.'))

sourcehash=hashlib.sha256((ROOT/MAP['source']).read_bytes()).hexdigest()
report={'source':MAP['source'],'sourceSha256':sourcehash,'issue':MAP['issue'],'articleCount':len(export),'selectedLineCount':len(used),'pageCount':len(LAYOUT),'articles':export,'pageCoverage':{str(p):coverage[p] for p in range(1,29)},'method':'PDFKit layout extraction plus manually reviewed issue-specific article map. Deterministic HTML generation; not a generic automatic splitter.'}
(ROOT/'work/article-extraction/report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
notes={19:'Display event promotions; the underlying arts events are included from page 18.',24:'Real estate and service advertisements.',26:'Classified advertisements.'}
rows=[]
for p in range(1,29):
 listed=', '.join(next(a['title'] for a in MAP['articles'] if a['slug']==slug) for slug in coverage[p])
 rows.append([str(p),str(len(coverage[p])),listed or notes.get(p,'No article body selected.')])
content='<main class="notes"><a class="back" href="index.html">← Read the converted edition</a><h1>Conversion notes</h1><p>This proof of concept converts the October 7, 2026 issue into '+str(len(export))+' separate HTML pages. It includes news, letters, school and sports coverage, arts, features, an obituary, calendars, and newspaper notices. The branded real estate report is identified separately as a commercial feature.</p><h2>What was done</h2><p>PDFKit extracted the existing text and its coordinates from all 28 pages. An issue-specific map was manually assembled and checked to identify article boundaries, reading order, bylines, and continuation pages. A script reconstructs paragraphs, joins broken words, formats schedules as HTML tables, and generates the article pages. Sixteen photo and illustration crops are rendered from the original PDF.</p><h2>What still needs editorial review</h2><p>This is a draft conversion, not a fully automatic production pipeline. Paragraph breaks, compound-word hyphens, captions, source typos, and table transcription should be checked against the original. The PDF’s overlapping text required manual cleanup of one newspaper notice and recovery of the ReQuip byline. The library-events display title is supplied from the printed library identification. Photographs are included for selected stories; other photos remain available in the original PDF.</p><h2>Coverage of the printed issue</h2><p>Continuation pages are joined into the original story rather than published as duplicate articles. Article counts below include stories continued on that page. Advertisements, classifieds, staff masthead, subscription forms, display promotions, and cartoons remain in the original issue.</p>'+table(['Printed page','Stories using this page','Coverage'],rows)+'<h2>Reproducible source</h2><p>The project retains the PDF text/layout, the article map, and a line-level provenance report in <code>work/article-extraction/</code>. Run <code>python3 scripts/build-articles.py</code> to regenerate the HTML. These mappings apply to this one issue; a new issue requires new segmentation and review.</p><h2>Publishing and access</h2><p>These are plain static HTML pages. If the issue is member-only, apply membership protection to this entire article folder as well as its source PDFs and page previews.</p></main>'
(OUT/'conversion-notes.html').write_text(shell('Conversion notes',content))
print(f'Built {len(export)} HTML article pages, issue index, and conversion notes. {len(used)} PDF lines mapped without article overlaps.')
