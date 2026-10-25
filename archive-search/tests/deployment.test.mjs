import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {deploymentState} from '../scripts/deployment-state.mjs';
test('deployment state skips unchanged files, retries until recorded, and detects asset or target changes',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'post-deploy-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const publicDir=path.join(dir,'public');await fs.mkdir(publicDir);await fs.writeFile(path.join(publicDir,'manifest.json'),'{}');
 const options={publicDir,stateFile:path.join(dir,'cache/deployment.json'),target:'example/post-search'};
 assert.equal((await deploymentState(options)).changed,true);
 assert.equal((await deploymentState(options)).changed,true); // A failed upload must be retried.
 await deploymentState({...options,record:true});assert.equal((await deploymentState(options)).changed,false);
 await fs.writeFile(path.join(publicDir,'app.js'),'new code');assert.equal((await deploymentState(options)).changed,true);
 await deploymentState({...options,record:true});assert.equal((await deploymentState(options)).changed,false);
 assert.equal((await deploymentState({...options,target:'example/other-search'})).changed,true);
});
