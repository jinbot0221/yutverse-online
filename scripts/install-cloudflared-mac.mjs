import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,rmSync,mkdtempSync,renameSync,chmodSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

// Official 2025.11.1 source and Go's last Monterey-compatible major line.
// Modern prebuilt cloudflared Mac binaries target macOS 15; build pure Go here.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const commit='690f20c008b4b6d2f12756618b9136ef6d5e2f18';
const goVersion='go1.25.14';
const goChecksum='b09087a67d5792a8b0fcbf74212d62560c94ac8a8fd750ff920d8cb5f1e20118';
const tools=resolve(root,'.tools/monterey');
const run=(command,args,options={})=>execFileSync(command,args,{stdio:'inherit',...options});
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
try{
 if(process.platform!=='darwin'||process.arch!=='x64')throw Error('This installer is for Intel Macs (including 2015 MacBook Pro).');
 const osVersion=execFileSync('sw_vers',['-productVersion'],{encoding:'utf8'}).trim();
 if(Number(osVersion.split('.')[0])<12)throw Error('macOS 12 or later is required for this build.');
 const nodeMajor=Number(process.versions.node.split('.')[0]);
 if(nodeMajor<24)throw Error('This repository currently requires Node 24+. Keep a working Node installation; see MAC_SETUP.md for OS support limits.');
 mkdirSync(tools,{recursive:true});
 const compiler=resolve(tools,goVersion,'go/bin/go');
 if(!existsSync(compiler)){
  const temporary=mkdtempSync(join(tools,'go-download-'));
  try{
   const archive=resolve(temporary,'go.tgz');
   run('curl',['-fSL','--max-time','180',`https://go.dev/dl/${goVersion}.darwin-amd64.tar.gz`,'-o',archive]);
   if(sha(archive)!==goChecksum)throw Error('Official Go archive SHA256 mismatch. Not extracting it.');
   run('tar',['-xzf',archive,'-C',temporary]);
   if(existsSync(resolve(tools,goVersion)))throw Error('Incomplete compiler directory exists. Preserve it and choose a clean checkout.');
   mkdirSync(resolve(tools,goVersion));renameSync(resolve(temporary,'go'),resolve(tools,goVersion,'go'));
  }finally{rmSync(temporary,{recursive:true,force:true});}
 }
 const installed=execFileSync(compiler,['version'],{encoding:'utf8'}).trim();
 if(!installed.includes(` ${goVersion} `))throw Error('Unexpected cached Go compiler version.');
 const source=resolve(tools,'source');
 if(!existsSync(source))run('git',['clone','--depth','1','--branch','2025.11.1','https://github.com/cloudflare/cloudflared.git',source]);
 const head=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 if(head!==commit)throw Error('Cloudflared source commit mismatch.');
 if(execFileSync('git',['-C',source,'status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Cached source has local changes; refusing to build it.');
 const binary=resolve(root,'.tools/cloudflared-monterey');
 console.log('Building cloudflared 2025.11.1 for macOS 12+. This first build can take several minutes.');
 run(compiler,['build','-p','2','-mod=vendor','-buildvcs=false','-trimpath','-ldflags','-X main.Version=2025.11.1 -X main.BuildTime=source-monterey','-o',binary,'./cmd/cloudflared'],{
  cwd:source,env:{...process.env,CGO_ENABLED:'0',GOOS:'darwin',GOARCH:'amd64',GOTOOLCHAIN:'local',GOCACHE:resolve(tools,'build-cache'),GOMODCACHE:resolve(tools,'module-cache')},
 });
 chmodSync(binary,0o755);run(binary,['--version']);
 writeFileSync(resolve(root,'.tools/cloudflared-monterey.json'),JSON.stringify({commit,goVersion,sha256:sha(binary)},null,2)+'\n');
 console.log('Mac tunnel tool installed. Run npm run deploy:quick.');
}catch(error){console.error(error.message);process.exitCode=1;}
