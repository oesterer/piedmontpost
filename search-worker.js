import {IndexStore,SearchSession,log} from './progressive-search.js';
let store,job,session;
async function batch(id,current){
 const controller=new AbortController(),currentJob={id,controller};job=currentJob;
 try{
  const state=await current.next({signal:controller.signal,onResults:results=>postMessage({type:'results',id,results}),onProgress:progress=>postMessage({type:'progress',id,...progress})});
  if(job===currentJob)postMessage({type:'batch',id,...state});
 }catch(error){
  log(error.name==='AbortError'?'Search stopped':'Search failed',{id,error:error.message});
  if(job===currentJob)postMessage({type:error.name==='AbortError'?'stopped':'error',id,message:error.message});
 }finally{if(job===currentJob)job=null;}
}
onmessage=async ({data})=>{
 if(data.type==='init'){
  log('Worker initializing; preload latest index only',{indexes:data.manifest.indexes.length});
  try{
   store=new IndexStore(data.manifest,async(entry,signal)=>{
    const url=new URL(entry.url,data.base);log('Fetching index',{index:entry.id,url:url.href,cache:'force-cache (browser may use HTTP cache)'});
    const response=await fetch(url,{signal,cache:'force-cache'});
    if(!response.ok)throw Error('Could not load '+entry.id+' (HTTP '+response.status+').');
    return response.json();
   });
   await store.preload();log('Worker ready');postMessage({type:'ready'});
  }catch(error){log('Worker initialization failed',{error:error.message});postMessage({type:'init-error',message:error.message});}
 }else if(data.type==='search'){
  log('New search requested',{id:data.id});job?.controller.abort();session=new SearchSession(store,data.options);await batch(data.id,session);
 }else if(data.type==='more'&&session&&!job){log('Continue requested',{id:data.id});await batch(data.id,session);}
 else if(data.type==='stop'){log('Stop requested',{active:!!job});job?.controller.abort();}
};
