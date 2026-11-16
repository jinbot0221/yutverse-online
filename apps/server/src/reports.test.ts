import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createGameServer} from './server.ts';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/jfkAAAAASUVORK5CYII=';
const valid={category:'layout',title:'모바일 버튼 겹침',description:'세로 화면에서 말 이동 버튼이 화면 밖으로 나옵니다.',steps:'휴대폰을 세로로 돌리기',expected:'버튼이 화면 안에 보이기',nickname:'테스터',contact:'',diagnostics:{viewportWidth:390,viewportHeight:844,pixelRatio:3,gameMode:'online',gameStyle:'augment',round:6,roomCode:'ABC234',page:'/?token=secret',token:'never-store',password:'never-store'},screenshot:png};
async function open(path=':memory:'){const server=createGameServer({dbPath:path});await new Promise<void>(r=>server.http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(server.http.address() as {port:number}).port}`;const post=(body:unknown,headers:Record<string,string>={})=>fetch(url+'/api/reports',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return {server,url,post};}
test('reports persist privately with validated optional image/diagnostics, and operator tools export them',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yutverse-reports-')),path=join(dir,'yutverse.sqlite');let f=await open(path);try{
 const response=await f.post(valid);assert.equal(response.status,201);const receipt=await response.json();assert.match(receipt.id,/^[a-f0-9-]{36}$/);const row=f.server.store.db.prepare('SELECT * FROM issue_reports WHERE id=?').get(receipt.id)!;assert.equal(row.user_id,null);assert.equal(row.category,'layout');assert.equal(row.title,valid.title);assert.equal(row.screenshot_mime,'image/png');const diagnostic=JSON.parse(row.diagnostics as string);assert.equal(diagnostic.page,'/');assert.equal(diagnostic.token,undefined);assert.equal(diagnostic.password,undefined);
 assert.equal((await fetch(f.url+'/api/reports')).status,404);assert.equal((await fetch(f.url+'/api/reports/'+receipt.id)).status,404);
 await f.server.close();f=await open(path);assert.equal(f.server.store.db.prepare('SELECT COUNT(*) AS n FROM issue_reports').get()!.n,1);
 const env={...process.env,YUTVERSE_DATA_DIR:dir};const list=execFileSync(process.execPath,['scripts/reports.mjs','list'],{env,encoding:'utf8'});assert.ok(list.includes(receipt.id));const details=JSON.parse(execFileSync(process.execPath,['scripts/reports.mjs','show',receipt.id],{env,encoding:'utf8'}));assert.equal(details.title,valid.title);assert.equal(details.screenshot,undefined);const exported=join(dir,'exported');execFileSync(process.execPath,['scripts/reports.mjs','export',receipt.id,exported],{env});assert.deepEqual(readFileSync(join(exported,receipt.id+'.png')),Buffer.from(png.split(',')[1],'base64'));assert.equal(JSON.parse(readFileSync(join(exported,receipt.id+'.json'),'utf8')).has_screenshot,true);
 }finally{await f.server.close();rmSync(dir,{recursive:true,force:true});}
});
test('reports reject invalid input, disguised images, oversized bodies and stale authentication',async()=>{const f=await open();try{
 for(const body of [{...valid,title:' '},{...valid,description:'short'},{...valid,category:'invalid'},{...valid,diagnostics:{viewportWidth:-1}},{...valid,screenshot:'data:image/png;base64,aGVsbG8='},{...valid,screenshot:'data:image/svg+xml;base64,PHN2Zy8+'}])assert.equal((await f.post(body)).status,400);
 assert.equal((await f.post({...valid,screenshot:'x'.repeat(1600000)})).status,413);assert.equal((await f.post(valid,{Authorization:'Bearer invalid'})).status,401);assert.equal(f.server.store.db.prepare('SELECT COUNT(*) AS n FROM issue_reports').get()!.n,0);
 }finally{await f.server.close()}});
test('reports accept UTF-8 descriptions beyond the game API limit, optional fields, and enforce throttling',async()=>{const f=await open();try{
 const token=f.server.store.createUser('제보자');const result=await f.post({category:'bug',title:'긴 내용 제보',description:'내용확인'.repeat(900),diagnostics:null},{Authorization:`Bearer ${token.token}`});assert.equal(result.status,201);assert.equal(f.server.store.db.prepare('SELECT user_id FROM issue_reports').get()!.user_id,token.id);
 for(let i=0;i<10;i++)assert.equal((await f.post({category:'other',title:'기타 문제 제보',description:'제보 내용을 충분히 작성합니다.'})).status,201);assert.equal((await f.post(valid)).status,429);
 }finally{await f.server.close()}});
