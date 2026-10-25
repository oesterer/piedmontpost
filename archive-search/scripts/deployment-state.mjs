#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function publicationDigest(directory){
 const hash=createHash('sha256');
 async function visit(relative=''){
  const entries=await fs.readdir(path.join(directory,relative),{withFileTypes:true});
  entries.sort((a,b)=>a.name.localeCompare(b.name,'en'));
  for(const entry of entries){
   const name=relative?relative+'/'+entry.name:entry.name;
   if(entry.isDirectory())await visit(name);
   else if(entry.isFile()){
    const bytes=await fs.readFile(path.join(directory,name));
    hash.update(JSON.stringify([name,bytes.length]));hash.update(bytes);
   }else throw Error('Unexpected non-file in deployment: '+name);
  }
 }
 await visit();return hash.digest('hex');
}
export async function deploymentState({publicDir=path.join(ROOT,'public'),stateFile=path.join(ROOT,'cache/deployment.json'),target=process.env.GITHUB_REPOSITORY,record=false}={}){
 if(!target||!/^[-a-zA-Z0-9_.]+\/[-a-zA-Z0-9_.]+$/.test(target))throw Error('GITHUB_REPOSITORY (owner/repository) is required');
 const sha256=await publicationDigest(publicDir);
 let previous;
 try{previous=JSON.parse(await fs.readFile(stateFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const changed=previous?.sha256!==sha256||previous?.target!==target||previous?.provider!=='github-pages';
 if(record){
  await fs.mkdir(path.dirname(stateFile),{recursive:true});
  await fs.writeFile(stateFile,JSON.stringify({version:1,provider:'github-pages',sha256,target,deployedAt:new Date().toISOString()})+'\n');
 }
 return {changed,sha256};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const command=process.argv[2];if(!['check','record'].includes(command))throw Error('Usage: deployment-state.mjs check|record');
  const state=await deploymentState({record:command==='record'});
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`changed=${state.changed}\n`);
  console.log(command==='record'?'Recorded successful publication.':state.changed?'Publication needs deployment.':'Publication unchanged; deployment skipped.');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
