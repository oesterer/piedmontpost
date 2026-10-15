#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const digest=value=>createHash('sha256').update(value).digest('hex');
export function issueId(issue){const url=new URL(issue.sourceUrl||issue.file);let pathname=url.pathname;try{pathname=decodeURIComponent(pathname);}catch{}return digest(url.origin+pathname);}
export function bucketFor(date,quarterThrough='2026-06-30') {
 if(date>quarterThrough)return {id:date,kind:'weekly',from:date,to:date};
 const year=Number(date.slice(0,4)),quarter=Math.ceil(Number(date.slice(5,7))/3);
 return {id:`${year}-Q${quarter}`,kind:'quarterly',from:`${year}-${String(quarter*3-2).padStart(2,'0')}-01`,to:new Date(Date.UTC(year,quarter*3,0)).toISOString().slice(0,10)};
}
async function atomic(file,contents){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+process.pid+'.tmp';await fs.writeFile(temp,contents);await fs.rename(temp,file);}
export async function readCachedIndex(cacheDir=path.join(ROOT,'cache')) {
 const manifest=JSON.parse(await fs.readFile(path.join(cacheDir,'manifest.json'),'utf8'));
 const issues=[],pages=[];
 for(const [id,entry]of Object.entries(manifest.entries)) {
  if(!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid issue cache identifier');
  const data=JSON.parse(await fs.readFile(path.join(cacheDir,'issues',id+'.json'),'utf8'));
  if(!data.issue||data.pages?.length!==data.issue.pages)throw Error('Incomplete cached issue: '+entry.label);
  issues.push({...data.issue,file:entry.sourceUrl,sourceUrl:entry.sourceUrl});
  pages.push(...data.pages.map(p=>({...p,file:entry.sourceUrl,sourceUrl:entry.sourceUrl})));
 }
 return {source:'https://www.piedmont-post.com/archive',issues,pages};
}
export async function publishIndexes(index,{outputDir=path.join(ROOT,'public'),settings}={}) {
 settings??=JSON.parse(await fs.readFile(path.join(ROOT,'settings.json'),'utf8'));
 const cutoff=settings.quarterThrough;
 if(!/^\d{4}-(03-31|06-30|09-30|12-31)$/.test(cutoff))throw Error('quarterThrough must be a calendar quarter end');
 const groups=new Map(),issuesById=new Map(),seenPages=new Set();
 for(const issue of index.issues) {
  const id=issueId(issue);if(issuesById.has(id))throw Error('Duplicate issue in input');
  const bucket=bucketFor(issue.date,cutoff);
  // Two different PDFs on the same date must remain distinct weekly indexes.
  const key=bucket.kind==='weekly'?bucket.id+'-'+id.slice(0,8):bucket.id;
  if(!groups.has(key))groups.set(key,{...bucket,id:key,issues:[],pages:[]});
  const record={...issue,id,indexId:key};
  groups.get(key).issues.push(record);issuesById.set(id,record);
 }
 for(const page of index.pages) {
  const id=issueId(page),issue=issuesById.get(id);
  if(!issue||issue.date!==page.date)throw Error('Page has no corresponding issue');
  const key=id+':'+page.page;if(seenPages.has(key))throw Error('Duplicate PDF page in input');seenPages.add(key);
  groups.get(issue.indexId).pages.push({...page,issueId:id});
 }
 const descriptors=[];
 await fs.mkdir(path.join(outputDir,'indexes'),{recursive:true});
 if(path.resolve(outputDir)!==path.join(ROOT,'public')) {
  for(const name of ['index.html','style.css','app.js','search.js','pdf-links.js','progressive-search.js','search-worker.js'])await fs.copyFile(path.join(ROOT,'public',name),path.join(outputDir,name));
 }
 for(const group of groups.values()) {
  group.issues.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  group.pages.sort((a,b)=>b.date.localeCompare(a.date)||a.issueId.localeCompare(b.issueId)||a.page-b.page);
  for(const issue of group.issues) {
   const pages=group.pages.filter(p=>p.issueId===issue.id);
   if(pages.length!==issue.pages||pages.some((p,i)=>p.page!==i+1))throw Error('Missing or misnumbered pages for '+issue.date);
  }
  const contents=Buffer.from(JSON.stringify({version:1,id:group.id,issues:group.issues,pages:group.pages})+'\n');
  const hash=digest(contents),filename=group.id+'.'+hash.slice(0,16)+'.json';
  const zipped=gzipSync(contents,{level:9});
  const brotli=brotliCompressSync(contents,{params:{[constants.BROTLI_PARAM_QUALITY]:5}});
  const target=path.join(outputDir,'indexes',filename);
  // Content-addressed files are immutable. Keep old generations for open tabs.
  try{await fs.access(target);}catch{await atomic(target,contents);await atomic(target+'.gz',zipped);await atomic(target+'.br',brotli);}
  descriptors.push({id:group.id,kind:group.kind,url:'indexes/'+filename,from:group.from,to:group.to,latestIssue:group.issues[0].date,oldestIssue:group.issues.at(-1).date,issueCount:group.issues.length,pageCount:group.pages.length,bytes:contents.length,gzipBytes:zipped.length,brotliBytes:brotli.length,sha256:hash});
 }
 descriptors.sort((a,b)=>b.latestIssue.localeCompare(a.latestIssue)||a.id.localeCompare(b.id));
 const issues=[...issuesById.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 const manifest={version:1,generatedAt:new Date().toISOString(),source:index.source,quarterThrough:cutoff,batchSize:settings.batchSize||20,memoryCacheBytes:settings.memoryCacheBytes||16777216,issueCount:issues.length,pageCount:index.pages.length,indexes:descriptors,issues};
 // The manifest is the final write: every referenced index already exists.
 await atomic(path.join(outputDir,'manifest.json'),JSON.stringify(manifest)+'\n');
 console.log(`Published ${descriptors.filter(d=>d.kind==='quarterly').length} quarterly and ${descriptors.filter(d=>d.kind==='weekly').length} weekly indexes; ${issues.length} issues, ${index.pages.length} pages.`);
 return manifest;
}
async function main(){
 const cacheDir=path.join(ROOT,'cache');
 try{await fs.access(path.join(cacheDir,'indexer.lock'));throw Error('Indexer is running; wait for it to finish before publishing');}catch(error){if(error.code!=='ENOENT')throw error;}
 await publishIndexes(await readCachedIndex(cacheDir));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
