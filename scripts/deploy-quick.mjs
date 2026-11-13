import {CLOUDFLARED_SOURCE} from './cloudflared-source.mjs';
import {spawn,execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mac=process.platform==='darwin';
const binary=resolve(root,mac?'.tools/cloudflared-monterey':'.tools/cloudflared-2026.11.0');
const port=Number(process.env.YUTVERSE_PUBLIC_PORT||3003);
const dataDir=resolve(process.env.YUTVERSE_PUBLIC_DATA_DIR||resolve(root,'data/public'));
const origin=`http://127.0.0.1:${port}`;
let app,tunnel,stopping=false,timeout,publicUrl,checking=false;
function stop(code=0){
 if(stopping)return;stopping=true;clearTimeout(timeout);
 tunnel?.kill('SIGTERM');app?.kill('SIGTERM');
 // Give the app time to close SQLite, then reap only children started here.
 const force=setTimeout(()=>{tunnel?.kill('SIGKILL');app?.kill('SIGKILL');process.exit(code)},5000);force.unref();
 Promise.all([app,tunnel].filter(Boolean).map(child=>child.exitCode!==null?Promise.resolve():new Promise(r=>child.once('exit',r)))).then(()=>{clearTimeout(force);process.exit(code)});
}
function fail(message){console.error(message);stop(1);}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop(0));
async function externalCheck(){
 if(checking||!publicUrl)return;checking=true;
 try{
  const run=path=>execFileSync('curl',['--fail','--silent','--show-error','--max-time','15',publicUrl+path],{encoding:'utf8'});
  const health=JSON.parse(run('/api/health'));
  if(health.ok!==true||!run('/').includes('<div id="root"></div>'))throw Error('Public web/API validation failed');
  const transport=run('/socket.io/?EIO=4&transport=polling');
  if(!transport.startsWith('0')||!transport.includes('"sid"'))throw Error('Public Socket.IO handshake failed');
  mkdirSync(dataDir,{recursive:true});writeFileSync(resolve(dataDir,'public-url.txt'),publicUrl+'\n');
  clearTimeout(timeout);
  console.log(`PUBLIC GAME URL: ${publicUrl}`);
  console.log('HTTPS web, API and Socket.IO handshake verified. This temporary URL needs this process and cloud environment to stay running.');
 }catch(error){fail(`Tunnel registered but external validation failed: ${error.message}`);}
}
try{
 if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24+ is required.');
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('YUTVERSE_PUBLIC_PORT must be 1024..65535.');
 if(!existsSync(resolve(root,'apps/web/dist/index.html')))throw Error('Run npm run build first.');
 if(!existsSync(binary))throw Error(mac?'Run npm run tunnel:install:mac first.':'Run npm run tunnel:install first.');
 let expected='51f7c68b57ed7269164075d7e789efce5b59355982f06392deeb037d982a51fd';
 if(mac){const build=JSON.parse(readFileSync(resolve(root,'.tools/cloudflared-monterey.json'),'utf8'));if(build.commit!==CLOUDFLARED_SOURCE.commit||build.goVersion!=='go1.25.14')throw Error('Unexpected Mac tunnel build.');expected=build.sha256;}
 if(createHash('sha256').update(readFileSync(binary)).digest('hex')!==expected)throw Error('Cloudflared checksum mismatch.');
 await new Promise((ready,reject)=>{const listener=createServer();listener.once('error',reject);listener.listen(port,'127.0.0.1',()=>listener.close(ready));});
 app=spawn(process.execPath,['--import','tsx',resolve(root,'apps/server/src/index.ts')],{cwd:root,env:{...process.env,NODE_ENV:'production',PORT:String(port),YUTVERSE_BIND_HOST:'127.0.0.1',YUTVERSE_DATA_DIR:dataDir},stdio:['ignore','inherit','inherit']});
 app.once('error',e=>fail(e.message));app.once('exit',code=>{if(!stopping)fail(`Application exited (${code}).`)});
 let ready=false;
 for(let i=0;i<60&&!stopping;i++){
  try{const r=await fetch(origin+'/api/health');if(r.ok&&(await r.json()).ok){ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 if(!ready||stopping)throw Error('Application did not become ready.');
 console.log('Production web/API ready; requesting a temporary Cloudflare Tunnel.');
 tunnel=spawn(binary,['tunnel','--no-autoupdate','--protocol','http2','--url',origin],{cwd:root,env:process.env,stdio:['ignore','pipe','pipe']});
 tunnel.once('error',e=>fail(e.message));tunnel.once('exit',code=>{if(!stopping)fail(`Cloudflare Tunnel exited (${code}). No public URL is confirmed.`)});
 let logTail='';
 const log=data=>{
  const text=data.toString();logTail=(logTail+text).slice(-10000);
  const match=logTail.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/);if(match)publicUrl=match[0];
  process.stdout.write(text.replace(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/g,'[public hostname pending validation]'));
  if(logTail.includes('Registered tunnel connection'))void externalCheck();
 };
 tunnel.stdout.on('data',log);tunnel.stderr.on('data',log);
 timeout=setTimeout(()=>fail('Tunnel readiness timed out after 60 seconds. Check api.trycloudflare.com and TCP 7844 access; the application will be stopped.'),60000);
}catch(error){fail(error.message);}
