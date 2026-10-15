import {log} from './progressive-search.js';
import {sourcePdfLink} from './pdf-links.js';
const $=id=>document.getElementById(id);
const query=$('query'),year=$('year'),issue=$('issue'),mode=$('mode'),order=$('order');
const results=$('results'),more=$('more'),status=$('status'),progress=$('progress');
const date=value=>new Date(value+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
const initial=new URLSearchParams(location.search);
query.value=initial.get('q')||'';mode.value=initial.get('mode')||'words';order.value=initial.get('order')||'newest';
let manifest,worker,ready=false,id=0,count=0,browseItems=[],browseOffset=0,browsing=true;
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function busy(value){$('collection').setAttribute('aria-busy',String(value));$('stop').hidden=!value;more.disabled=value;}
function updateURL(){const p=new URLSearchParams();for(const [key,e]of Object.entries({q:query,year,issue,mode,order}))if(e.value)p.set(key,e.value);history.replaceState(null,'','?'+p);}
function highlight(text,terms){const frag=document.createDocumentFragment();const escaped=terms.filter(Boolean).sort((a,b)=>b.length-a.length).map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));if(!escaped.length){frag.append(text);return frag;}const re=new RegExp('('+escaped.join('|')+')','gi');let last=0;for(const m of text.matchAll(re)){frag.append(text.slice(last,m.index));frag.append(node('mark',m[0]));last=m.index+m[0].length;}frag.append(text.slice(last));return frag;}
function externalLink(label,record,cls){const a=node('a',label,cls);a.href=sourcePdfLink(record);a.target='_blank';a.rel='noopener';return a;}
function appendResults(items){for(const match of items){const card=node('article',undefined,'result'),meta=node('div',date(match.date),'result-date');meta.append(node('small','Page '+match.page));if(match.title&&match.titleSource==='detected')meta.append(node('small','Detected headline'));const body=node('div'),heading=node('h3'),link=externalLink(undefined,match);link.append(highlight(match.title||'Page '+match.page+' · Piedmont Post',match.terms));heading.append(link);const excerpt=node('p');excerpt.append(highlight(match.excerpt,match.terms));body.append(heading,excerpt);card.append(meta,body,externalLink('Open page '+match.page+' ↗',match,'page-link'));results.append(card);count++;}status.textContent=count+' matching '+(count===1?'page':'pages')+' found so far';}
function fillIssues(){const current=issue.value;issue.replaceChildren(node('option','All issues'));issue.firstChild.value='';for(const item of manifest.issues.filter(i=>!year.value||i.date.startsWith(year.value+'-'))){const opt=node('option',date(item.date));opt.value=item.id;issue.append(opt);}issue.value=current;}
function browseMore(){let grid=results.querySelector('.issue-grid');if(!grid){grid=node('div',undefined,'issue-grid');results.append(grid);}for(const item of browseItems.slice(browseOffset,browseOffset+12)){const a=externalLink(undefined,item,'issue-card');a.append(node('div','Piedmont Post','paper-symbol'),node('div','WEEKLY EDITION','eyebrow'),node('h3',date(item.date)),node('p',item.pages+' pages'),node('span','Read this issue ↗','open-issue'));grid.append(a);}browseOffset+=12;more.hidden=browseOffset>=browseItems.length;more.textContent='Show more issues';}
function browse(){browsing=true;results.replaceChildren();$('results-title').textContent='Browse issues';progress.textContent='';busy(false);browseItems=manifest.issues.filter(i=>(!year.value||i.date.startsWith(year.value+'-'))&&(!issue.value||i.id===issue.value)).slice().sort((a,b)=>order.value==='oldest'?a.date.localeCompare(b.date):b.date.localeCompare(a.date));browseOffset=0;status.textContent=browseItems.length+' issues available';browseMore();}
function run(){if(!ready)return;id++;worker.postMessage({type:'stop'});$('error').hidden=true;updateURL();if(!query.value.trim()){browse();return;}browsing=false;count=0;results.replaceChildren();$('results-title').textContent='Results for “'+query.value.trim()+'”';status.textContent='Searching…';progress.textContent='Searching the selected issues…';more.hidden=true;more.textContent='Show '+manifest.batchSize+' more results';busy(true);worker.postMessage({type:'search',id,options:{query:query.value,year:year.value,issue:issue.value,mode:mode.value,order:order.value}});}
function showError(message,retry){const box=$('error');box.replaceChildren(node('p',message));if(retry){const b=node('button','Retry loading archive');b.addEventListener('click',load);box.append(b);}box.hidden=false;}
async function load(){
 ready=false;$('submit').disabled=true;worker?.terminate();$('error').hidden=true;status.textContent='Loading archive…';progress.textContent='';
 try{
  const started=performance.now();log('Loading manifest',{url:new URL('manifest.json',document.baseURI).href});
  const response=await fetch('manifest.json',{cache:'no-cache'});if(!response.ok)throw Error('Could not load the archive catalogue.');
  manifest=await response.json();if(manifest.version!==1||!manifest.indexes?.length||!Array.isArray(manifest.issues))throw Error('The archive catalogue is empty or unsupported.');
  log('Manifest ready',{indexes:manifest.indexes.length,issues:manifest.issueCount,pages:manifest.pageCount,elapsedMs:Math.round(performance.now()-started)});
  year.replaceChildren(node('option','All years'));year.firstChild.value='';for(const value of [...new Set(manifest.issues.map(i=>i.date.slice(0,4)))].sort().reverse()){const opt=node('option',value);opt.value=value;year.append(opt);}year.value=initial.get('year')||'';fillIssues();issue.value=initial.get('issue')||'';
  $('archive-count').textContent=manifest.issueCount.toLocaleString()+' issues · '+manifest.pageCount.toLocaleString()+' pages';
  worker=new Worker(new URL('./search-worker.js',import.meta.url),{type:'module'});
  worker.onerror=event=>{log('Worker error',{message:event.message});ready=false;busy(false);$('submit').disabled=true;showError('The search engine could not start or stopped unexpectedly. Please retry.',true);};
  worker.onmessage=({data})=>{
   if(data.type==='ready'){ready=true;$('submit').disabled=false;run();return;}
   if(data.type==='init-error'){busy(false);status.textContent='Archive unavailable';showError(data.message,true);return;}
   if(data.id!==id){log('Ignoring stale worker message',{type:data.type,id:data.id,currentId:id});return;}
   if(data.type==='results'){appendResults(data.results);log('Results displayed',{id,count:data.results.length,total:count});}
   else if(data.type==='progress'){progress.textContent='Searching '+(data.entry.kind==='weekly'?date(data.entry.from):date(data.entry.from)+' – '+date(data.entry.to))+'…';}
   else if(data.type==='batch'){
    busy(false);more.hidden=data.complete;more.textContent='Show '+manifest.batchSize+' more results';status.textContent=count+' matching '+(count===1?'page':'pages')+(data.complete?'':' found so far');progress.textContent=data.complete?'All selected issues searched.':'Search paused. Show more to continue through the archive.';
    if(data.complete&&!count){const empty=node('div',undefined,'empty');empty.append(node('h3','No matching pages'),node('p','Try fewer words, a different spelling, or a wider date range.'));results.append(empty);}
   }else if(data.type==='stopped'){busy(false);more.hidden=false;more.textContent='Continue search';progress.textContent='Search stopped. Continue to search more issues.';}
   else if(data.type==='error'){busy(false);more.hidden=false;more.textContent='Retry and continue';progress.textContent='Search incomplete.';showError(data.message+' Results already found are preserved. Retry to continue.');}
  };
  worker.postMessage({type:'init',manifest,base:new URL('.',document.baseURI).href});
 }catch(error){log('Archive initialization failed',{error:error.message});busy(false);showError(error.message+' Serve this folder over HTTP or HTTPS.',true);status.textContent='Archive unavailable';}
}
$('search-form').addEventListener('submit',e=>{e.preventDefault();run();});year.addEventListener('change',()=>{fillIssues();run();});for(const e of [issue,mode,order])e.addEventListener('change',run);query.addEventListener('search',run);
$('stop').addEventListener('click',()=>{worker?.postMessage({type:'stop'});progress.textContent='Stopping…';});more.addEventListener('click',()=>{if(browsing){browseMore();return;}$('error').hidden=true;busy(true);more.hidden=true;worker.postMessage({type:'more',id});});
for(const b of document.querySelectorAll('[data-query]'))b.addEventListener('click',()=>{query.value=b.dataset.query;run();});
load();
