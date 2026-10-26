import {searchPages,snippet} from './search.js';
// Temporary diagnostics: remove this helper and its calls when no longer needed.
export const log=(event,details={})=>console.info('[Archive search]',event,details);
const aborted=signal=>{if(signal?.aborted)throw new DOMException('Search stopped','AbortError');};
export class IndexStore {
 constructor(manifest,load,{maxFiles=4,maxBytes=manifest.memoryCacheBytes||16777216}={}){
  this.manifest=manifest;this.loader=load;this.maxFiles=maxFiles;this.maxBytes=maxBytes;this.cache=new Map();this.bytes=0;this.pinned=manifest.indexes[0]?.id;
 }
 async get(entry,signal){
  aborted(signal);
  if(this.cache.has(entry.id)){const item=this.cache.get(entry.id);this.cache.delete(entry.id);this.cache.set(entry.id,item);log('Index cache hit',{index:entry.id,cachedFiles:this.cache.size});return item.data;}
  const started=performance.now();log('Loading index',{index:entry.id,url:entry.url,bytes:entry.bytes});
  let data;try{data=await this.loader(entry,signal);aborted(signal);}catch(error){log('Index load interrupted or failed',{index:entry.id,error:error.message});throw error;}
  if(data.version!==1||data.id!==entry.id||!Array.isArray(data.pages)||data.pages.length!==entry.pageCount)throw Error('Invalid or incomplete index: '+entry.id);
  this.cache.set(entry.id,{data,bytes:entry.bytes});this.bytes+=entry.bytes;
  while(this.cache.size>this.maxFiles||this.bytes>this.maxBytes){
   const victim=[...this.cache.keys()].find(id=>id!==this.pinned&&id!==entry.id);if(!victim)break;
   this.bytes-=this.cache.get(victim).bytes;this.cache.delete(victim);log('Index evicted from memory',{index:victim});
  }
  log('Index ready',{index:entry.id,pages:data.pages.length,elapsedMs:Math.round(performance.now()-started),cachedFiles:this.cache.size,cachedRawBytes:this.bytes});
  return data;
 }
 async preload(signal){if(this.manifest.indexes.length)await this.get(this.manifest.indexes[0],signal);}
}
export class SearchSession {
 constructor(store,{query,year='',issue='',mode='words',order='newest'}={}){
  this.store=store;this.query=query.trim();this.year=year;this.issue=issue;this.mode=mode;this.order=order;
  const selected=issue?store.manifest.issues.find(i=>i.id===issue):null;
  this.entries=store.manifest.indexes.filter(e=>(!year||(e.from<=year+'-12-31'&&e.to>=year+'-01-01'))&&(!issue||selected?.indexId===e.id));
  this.entries.sort((a,b)=>order==='oldest'?a.oldestIssue.localeCompare(b.oldestIssue):b.latestIssue.localeCompare(a.latestIssue));
  this.cursor=0;this.pending=[];this.offset=0;this.delivered=0;
  log('Search session created',{query:this.query,year,issue,mode,order,indexes:this.entries.length});
 }
 get complete(){return this.cursor>=this.entries.length&&this.offset>=this.pending.length;}
 async next({limit=this.store.manifest.batchSize||20,signal,onResults=()=>{},onProgress=()=>{}}={}){
  let sent=0;log('Search batch started',{limit,nextIndex:this.cursor,bufferedResults:this.pending.length-this.offset,delivered:this.delivered});
  while(sent<limit){
   aborted(signal);
   if(this.offset<this.pending.length){
    const batch=this.pending.slice(this.offset,this.offset+limit-sent);this.offset+=batch.length;this.delivered+=batch.length;sent+=batch.length;
    log('Results emitted',{count:batch.length,totalDelivered:this.delivered,bufferedResults:this.pending.length-this.offset});onResults(batch);continue;
   }
   this.pending=[];this.offset=0;
   if(this.cursor>=this.entries.length)break;
   const entry=this.entries[this.cursor];
   onProgress({entry,searched:this.cursor,total:this.entries.length});
   // Advance only after a successful load/search. Retry resumes this exact file.
   const data=await this.store.get(entry,signal);aborted(signal);
   const pages=data.pages.filter(p=>(!this.year||p.date.startsWith(this.year+'-'))&&(!this.issue||p.issueId===this.issue));
   const started=performance.now();
   const matches=searchPages(pages,this.query,{mode:this.mode,sort:this.order});
   this.pending=matches.map(match=>({date:match.date,page:match.page,sourceUrl:match.sourceUrl||match.file,title:match.title,titleSource:match.titleSource,terms:match.terms,excerpt:snippet(match.excerptText||match.text,match.terms)}));
   log('Index searched',{index:entry.id,pages:pages.length,matches:matches.length,elapsedMs:Math.round(performance.now()-started)});
   this.cursor++;
  }
  log(this.complete?'Search complete':'Search paused at result limit',{delivered:this.delivered,searched:this.cursor,total:this.entries.length,bufferedResults:this.pending.length-this.offset});
  return {complete:this.complete,delivered:this.delivered,searched:this.cursor,total:this.entries.length};
 }
}
