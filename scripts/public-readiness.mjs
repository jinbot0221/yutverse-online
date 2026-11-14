import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
const run=promisify(execFile);
export class PublicProbeError extends Error{
 constructor(message,transient=false){super(message);this.transient=transient;}
}
export async function probeEndpoint(url,{timeoutMs=10000,signal}={}){
 try{
  const {stdout}=await run('curl',['--fail','--silent','--show-error','--connect-timeout','5','--max-time',String(Math.max(.1,timeoutMs/1000)),'--write-out','\n%{http_code}',url],{encoding:'utf8',maxBuffer:2*1024*1024,signal});
  const split=stdout.lastIndexOf('\n');return {status:Number(stdout.slice(split+1)),body:stdout.slice(0,split)};
 }catch(error){
  if(signal?.aborted||error.name==='AbortError')throw error;
  const code=Number(error.code),status=Number(String(error.stdout||'').trim().split('\n').at(-1));
  const proxyStatus=String(error.stderr||'').match(/CONNECT tunnel failed, response (\d{3})/);
  if(proxyStatus&&[401,403,407,429].includes(Number(proxyStatus[1])))throw new PublicProbeError(`Proxy HTTP ${proxyStatus[1]}`);
  if(code===6)throw new PublicProbeError('DNS is not ready yet',true);
  if([5,7,28,52,56].includes(code))throw new PublicProbeError(`Connection not ready (curl ${code})`,true);
  if(code===22)throw new PublicProbeError(`HTTP ${status}`,[404,408,500,502,503,504,530].includes(status));
  throw new PublicProbeError(`Public request failed (curl ${error.code||'unavailable'}); TLS and access checks were kept enabled`);
 }
}
const transientStatus=status=>[404,408,500,502,503,504,530].includes(status);
function checkResponse(result,path){
 if(result.status!==200)throw new PublicProbeError(`HTTP ${result.status}`,transientStatus(result.status));
 if(path==='/api/health'){
  try{if(JSON.parse(result.body).ok===true)return;}catch{}
  throw new PublicProbeError('Public health endpoint returned unexpected content');
 }
 if(path==='/'&&result.body.includes('<div id="root"></div>'))return;
 if(path.startsWith('/socket.io/')){
  try{if(result.body.startsWith('0')&&typeof JSON.parse(result.body.slice(1)).sid==='string')return;}catch{}
 }
 throw new PublicProbeError(`Public ${path==='/'?'web':'Socket.IO'} endpoint returned unexpected content`);
}
export async function waitForPublicGame(url,{timeoutMs=120000,probe=probeEndpoint,now=Date.now,sleep=(ms,signal)=>delay(ms,undefined,{signal}),signal,onRetry=()=>{}}={}){
 const deadline=now()+timeoutMs;let attempt=0,lastError;
 while(now()<deadline){
  signal?.throwIfAborted();attempt++;
  try{
   for(const path of ['/api/health','/','/socket.io/?EIO=4&transport=polling']){
    signal?.throwIfAborted();const remaining=deadline-now();if(remaining<=0)throw new PublicProbeError('Readiness deadline reached',true);
    checkResponse(await probe(url+path,{timeoutMs:Math.min(10000,remaining),signal}),path);
   }
   return {attempts:attempt};
  }catch(error){
   if(signal?.aborted||!error.transient)throw error;
   lastError=error;const wait=Math.min(5000,attempt*1000,deadline-now());if(wait<=0)break;
   onRetry({attempt,waitMs:wait,reason:error.message});await sleep(wait,signal);
  }
 }
 throw new Error(`Public address did not become ready within ${Math.round(timeoutMs/1000)} seconds. Last result: ${lastError?.message||'timeout'}. No public URL is confirmed.`);
}
