import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io,type Socket} from 'socket.io-client';
import {chooseMove,chooseRoute,legalMoves,createGame,type State} from '@yutverse/engine';
import {createGameServer,type Room} from './server.ts';
type Reply={ok:boolean;error?:string;room?:Room&{me:number}};
async function open(dbPath=':memory:',clock={time:1000000}){
 let seed=710;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const server=createGameServer({dbPath,now:()=>clock.time,random});
 await new Promise<void>(r=>server.http.listen(0,'127.0.0.1',r));const address=server.http.address() as {port:number};const url=`http://127.0.0.1:${address.port}`;
 const sockets:Socket[]=[];
 async function connect(token:string){const socket=io(url,{auth:{token},transports:['websocket'],forceNew:true,reconnection:false});sockets.push(socket);await new Promise<void>((resolve,reject)=>{socket.once('connect',()=>resolve());socket.once('connect_error',reject)});return socket;}
 async function session(name:string){const r=await fetch(`${url}/api/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});assert.equal(r.status,201);return await r.json() as {id:string;name:string;token:string};}
 async function close(){sockets.forEach(s=>s.disconnect());await server.close();}
 return {server,url,connect,session,close,clock};
}
const request=(socket:Socket,event:string,data:object={}):Promise<Reply>=>socket.timeout(3000).emitWithAck(event,data);
async function snapshot(socket:Socket){const r=await request(socket,'sync');assert.equal(r.ok,true,r.error);return r.room!;}
async function action(socket:Socket,kind:string,extra:object={}){const room=await snapshot(socket);return request(socket,'act',{revision:room.revision,kind,...extra});}
async function setupRoom(f:Awaited<ReturnType<typeof open>>,count:2|3|4){const users=[],clients=[];for(let i=0;i<count;i++){const user=await f.session(`여행자${i+1}`);users.push(user);clients.push(await f.connect(user.token));}
 const made=await request(clients[0],'create',{capacity:count});assert.equal(made.ok,true,made.error);const code=made.room!.code;
 for(let i=1;i<count;i++)assert.equal((await request(clients[i],'join',{code})).ok,true);
 return {users,clients,code};
}
async function start(clients:Socket[]){for(const c of clients)assert.equal((await request(c,'ready')).ok,true);assert.equal((await request(clients[0],'start')).ok,true);}
async function chooseInitial(clients:Socket[]){for(let i=0;i<clients.length;i++){const room=await snapshot(clients[i]);assert.equal(room.state!.selection!.player,i);assert.equal((await action(clients[i],'choose',{id:room.state!.selection!.offers[0]})).ok,true);}}
// Simulated human clients can issue many legitimate actions. Advance the test clock
// between requests so production rate limiting stays enabled in these tests.
function pace(f:Awaited<ReturnType<typeof open>>){f.clock.time+=2000;}
test('real sockets enforce membership, readiness, ownership, revision, selection privacy and valid actions',async()=>{
 const f=await open();try{
  const {clients,code}=await setupRoom(f,3);
  assert.equal((await request(clients[0],'start')).ok,false);
  const outsider=await f.connect((await f.session('외부')).token);assert.equal((await request(outsider,'join',{code})).ok,false);
  assert.equal((await request(outsider,'act',{kind:'throw',revision:0})).ok,false);
  await start(clients);let view=await snapshot(clients[0]);assert.equal(view.state!.selection!.offers.length,3);
  assert.equal((await snapshot(clients[1])).state!.selection!.offers.length,0);
  assert.equal((await action(clients[0],'throw')).ok,false);
  assert.equal((await action(clients[1],'choose',{id:view.state!.selection!.offers[0]})).ok,false);
  await chooseInitial(clients);pace(f);
  assert.equal((await action(clients[1],'throw')).ok,false);
  view=await snapshot(clients[0]);const revision=view.revision;
  const forged=await request(clients[0],'act',{kind:'throw',revision,result:{steps:999},state:{phase:'over'}});assert.equal(forged.ok,true);
  assert.equal((await request(clients[0],'act',{kind:'throw',revision})).ok,false);
  view=await snapshot(clients[0]);assert.ok(view.state!.result===null||view.state!.result.steps<=5);
  if(view.state!.phase==='move'){assert.equal((await action(clients[0],'move',{index:99})).ok,false);assert.equal((await action(clients[0],'move',{index:'0'})).ok,false);}
  assert.equal((await action(clients[0],'use',{id:'fake'})).ok,false);
 }finally{await f.close();}
});
for(const count of [2,3,4] as const)test(`${count}-player authoritative match finishes, broadcasts ranks and persists differential points exactly once`,async()=>{
 const f=await open();try{
  const {clients}=await setupRoom(f,count);await start(clients);let actions=0;
  while(actions++<3000){pace(f);const r=await snapshot(clients[0]),s=r.state!;if(s.phase==='over')break;
   const actor=s.selection?.player??s.turn;const own=await snapshot(clients[actor]);const state=own.state!;
   const reply=state.selection?await action(clients[actor],'choose',{id:state.selection.offers[0]}):state.phase==='throw'?await action(clients[actor],'throw'):legalMoves(state).length?await action(clients[actor],'move',{index:chooseMove(state,'hard'),route:chooseRoute(state,chooseMove(state,'hard'),'hard')}):await action(clients[actor],'skip');
   assert.equal(reply.ok,true,reply.error);
  }
  const last=await snapshot(clients[0]);assert.equal(last.state!.phase,'over');assert.equal(new Set(last.state!.ranks).size,count);
  for(const c of clients)assert.deepEqual((await snapshot(c)).state!.ranks,last.state!.ranks);
  const rankings=await (await fetch(`${f.url}/api/ranking`)).json() as {points:number}[];
  assert.deepEqual(rankings.map(r=>r.points).sort((a,b)=>b-a),count===2?[20,0]:count===3?[30,10,0]:[40,20,5,0]);
  const before=f.server.store.db.prepare('SELECT COUNT(*) AS n FROM participants').get()!.n;
  f.clock.time+=1000;f.server.tick();assert.equal(f.server.store.db.prepare('SELECT COUNT(*) AS n FROM participants').get()!.n,before);
  assert.ok(Number(f.server.store.db.prepare('SELECT COUNT(*) AS n FROM augment_choices').get()!.n)>=count);
 }finally{await f.close();}
});
test('selection timeout, reconnection grace, disconnect forfeits and bottom ranks are server-controlled',async()=>{
 const f=await open();try{
  const {clients,users}=await setupRoom(f,3);await start(clients);
  f.clock.time+=59999;f.server.tick();assert.equal((await snapshot(clients[0])).state!.choices.length,0);
  f.clock.time++;f.server.tick();assert.equal((await snapshot(clients[1])).state!.choices.length,1);
  for(let i=1;i<3;i++){const r=await snapshot(clients[i]);assert.equal((await action(clients[i],'choose',{id:r.state!.selection!.offers[0]})).ok,true);}
  const before=(await snapshot(clients[0])).state;
  clients[1].disconnect();await new Promise(r=>setTimeout(r,20));const reconnected=await f.connect(users[1].token);
  assert.equal((await snapshot(reconnected)).me,1);assert.deepEqual((await snapshot(reconnected)).state,before);
  reconnected.disconnect();await new Promise(r=>setTimeout(r,20));f.clock.time+=90001;f.server.tick();
  assert.ok((await snapshot(clients[0])).state!.forfeited.includes(1));
  assert.equal((await action(clients[2],'forfeit')).ok,true);assert.deepEqual((await snapshot(clients[0])).state!.ranks,[0,2,1]);
 }finally{await f.close();}
});
test('turn timeout excludes a stalled player and selection does not consume the turn timer',async()=>{
 const f=await open();try{const {clients}=await setupRoom(f,3);await start(clients);
  f.clock.time+=61000;f.server.tick();assert.equal((await snapshot(clients[0])).state!.forfeited.length,0);
  for(let i=1;i<3;i++){const r=await snapshot(clients[i]);await action(clients[i],'choose',{id:r.state!.selection!.offers[0]});}
  f.clock.time+=120001;f.server.tick();assert.ok((await snapshot(clients[0])).state!.forfeited.includes(0));
 }finally{await f.close();}
});
test('SQLite restores live match, sessions and augment choices across a server restart; history remains after completion',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yutverse-')),db=join(dir,'game.sqlite'),clock={time:1000000};let f=await open(db,clock);
 try{const {clients,users}=await setupRoom(f,3);assert.equal((await request(clients[0],'character',{character:'mage'})).ok,true);await start(clients);await chooseInitial(clients);const before=(await snapshot(clients[0])).state;assert.equal(before!.players[0].character,'mage');
  await f.close();f=await open(db,clock);const restored=[];for(const user of users)restored.push(await f.connect(user.token));
  assert.deepEqual((await snapshot(restored[0])).state,before);
  assert.equal((await action(restored[1],'forfeit')).ok,true);assert.equal((await action(restored[2],'forfeit')).ok,true);
  const history=await (await fetch(`${f.url}/api/history`,{headers:{Authorization:`Bearer ${users[0].token}`}})).json() as {rank:number;points:number}[];assert.equal(history[0].rank,1);assert.equal(history[0].points,30);
  assert.equal((await fetch(`${f.url}/api/history`)).status,401);
  await f.close();f=await open(db,clock);assert.equal(f.server.store.leaderboard().length,3);assert.equal(f.server.store.history(users[0].id).length,1);
 }finally{await f.close();rmSync(dir,{recursive:true,force:true});}
});
test('foreign origins and invalid credentials cannot open a socket',async()=>{
 const f=await open();try{
  const user=await f.session('보안 확인');
  for(const config of [{auth:{token:'invalid'}},{auth:{token:user.token},extraHeaders:{Origin:'https://unrelated.invalid'}}]){
   const socket=io(f.url,{...config,forceNew:true,reconnection:false,transports:['websocket']});await new Promise<void>((resolve,reject)=>{socket.once('connect',()=>{socket.disconnect();reject(Error('unexpected connection'))});socket.once('connect_error',()=>{socket.disconnect();resolve()})});
  }
 }finally{await f.close();}
});
test('completed-room broadcasts do not replace a new lobby; session rate limit rejects flooding',async()=>{
 const f=await open();try{const {clients}=await setupRoom(f,3);await start(clients);await action(clients[1],'forfeit');await action(clients[2],'forfeit');
  assert.equal((await request(clients[0],'leave')).ok,true);assert.equal((await request(clients[0],'create',{capacity:4})).ok,true);
  const newRoom=await snapshot(clients[0]);assert.equal(newRoom.capacity,4);assert.equal(newRoom.state,null);
  let rejected=false;for(let i=0;i<50;i++){const reply=await request(clients[0],'sync');if(!reply.ok){rejected=true;break;}}assert.equal(rejected,true);
 }finally{await f.close();}
});
test('two-player room restores a reconnected seat and records a forfeit as 20/0 points',async()=>{
 const f=await open();try{const {clients,users}=await setupRoom(f,2);await start(clients);await chooseInitial(clients);
  clients[1].disconnect();await new Promise(r=>setTimeout(r,20));const restored=await f.connect(users[1].token);
  const room=await snapshot(restored);assert.equal(room.capacity,2);assert.equal(room.me,1);assert.equal(room.state!.players.length,2);
  assert.equal((await action(restored,'forfeit')).ok,true);assert.deepEqual((await snapshot(clients[0])).state!.ranks,[0,1]);
  assert.equal(f.server.store.history(users[0].id)[0].points,20);assert.equal(f.server.store.history(users[1].id)[0].points,0);
 }finally{await f.close();}
});
test('server requires a legal fork choice and ignores forged routes',async()=>{
 const f=await open();try{const {clients}=await setupRoom(f,2);await start(clients);await chooseInitial(clients);
  // Arrange a server-owned checkpoint; actions still travel over real sockets.
  const room=[...f.server.rooms.values()][0];room.state!.phase='move';room.state!.result={name:'개',steps:2,extra:false};room.state!.throws=0;room.state!.players[0].pieces[0]={node:'o5',history:[]};
  assert.equal((await action(clients[0],'move',{index:0})).ok,false);assert.equal((await action(clients[0],'move',{index:0,route:'not-a-route'})).ok,false);
  assert.equal((await action(clients[0],'move',{index:0,route:'outer'})).ok,true);assert.equal((await snapshot(clients[0])).state!.players[0].pieces[0].node,'o7');
 }finally{await f.close();}
});
test('hero choices synchronize, reset readiness and are locked once a match starts',async()=>{
 const f=await open();try{const {clients,users}=await setupRoom(f,2);
  assert.equal((await request(clients[0],'ready')).ok,true);
  assert.equal((await request(clients[0],'character',{character:'unknown'})).ok,false);
  assert.equal((await snapshot(clients[1])).members[0].ready,true);
  assert.equal((await request(clients[0],'character',{character:'dwarf',userId:users[1].id})).ok,true);
  let view=await snapshot(clients[1]);assert.equal(view.members[0].character,'dwarf');assert.equal(view.members[0].ready,false);assert.equal(view.members[1].character,'otter');
  assert.equal((await request(clients[1],'character',{character:'archer'})).ok,true);await start(clients);
  view=await snapshot(clients[0]);assert.deepEqual(view.state!.players.map(p=>p.character),['dwarf','archer']);
  assert.equal((await request(clients[0],'character',{character:'mage'})).ok,false);assert.deepEqual((await snapshot(clients[1])).state!.players.map(p=>p.character),['dwarf','archer']);
 }finally{await f.close()}
});
async function account(f:Awaited<ReturnType<typeof open>>,login:string,nickname=login,token?:string){const response=await fetch(f.url+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({login,password:'a-test-password-24',nickname})});assert.equal(response.status,201);return await response.json() as {token:string;user:{id:string;name:string;login:string}};}
async function signIn(f:Awaited<ReturnType<typeof open>>,login:string,password='a-test-password-24'){return fetch(f.url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login,password})});}
test('accounts validate input, hash salted passwords, accept case-insensitive IDs and revoke sessions on logout',async()=>{
 const f=await open();try{
  const a=await account(f,'Alice_01','달빛'),b=await account(f,'Bob_02');assert.equal(a.user.name,'달빛');
  const rows=f.server.store.db.prepare('SELECT salt,password_hash FROM accounts').all();assert.notEqual(rows[0].salt,rows[1].salt);assert.notEqual(rows[0].password_hash,rows[1].password_hash);assert.ok(rows.every(r=>r.password_hash!=='a-test-password-24'));
  assert.equal((await fetch(f.url+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:'ALICE_01',password:'a-test-password-24',nickname:'중복'})})).status,409);
  assert.equal((await fetch(f.url+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:'ok_id',password:'short',nickname:'짧음'})})).status,400);
  assert.equal((await signIn(f,'alice_01','wrong-password')).status,401);assert.equal((await signIn(f,'missing_user')).status,401);
  const login=await (await signIn(f,'ALICE_01')).json() as typeof a;assert.equal(login.user.id,a.user.id);
  const headers={Authorization:`Bearer ${login.token}`};assert.equal((await fetch(f.url+'/api/auth/me',{headers})).status,200);assert.equal((await fetch(f.url+'/api/account/records')).status,401);
  const socket=await f.connect(login.token);assert.equal((await fetch(f.url+'/api/auth/logout',{method:'POST',headers})).status,200);assert.equal((await fetch(f.url+'/api/auth/me',{headers})).status,401);assert.equal((await fetch(f.url+'/api/auth/me',{headers:{Authorization:`Bearer ${b.token}`}})).status,200);
  await new Promise(r=>setTimeout(r,20));assert.equal(socket.connected,false);
 }finally{await f.close()}
});
test('exit during augmentation forfeits exactly once, leaves the room and account history survives a new device and restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yutverse-account-')),db=join(dir,'game.sqlite');let f=await open(db);
 try{const a=await account(f,'player_one','첫 번째'),b=await account(f,'player_two','두 번째');const first=await f.connect(a.token),second=await f.connect(b.token);
  const made=await request(first,'create',{capacity:2});await request(second,'join',{code:made.room!.code});await start([first,second]);
  assert.equal((await fetch(f.url+'/api/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${b.token}`}})).status,409);
  assert.equal((await request(second,'exit')).ok,true);assert.equal((await request(second,'exit')).ok,false);
  const room=await snapshot(first);assert.deepEqual(room.state!.ranks,[0,1]);assert.deepEqual(room.state!.forfeited,[1]);assert.equal('login' in room.members[0],false);
  assert.equal(f.server.store.history(b.user.id).length,1);assert.equal(f.server.store.history(b.user.id)[0].forfeited,1);
  await f.close();f=await open(db);const login=await (await signIn(f,'player_two')).json() as typeof b;
  const records=await (await fetch(f.url+'/api/account/records',{headers:{Authorization:`Bearer ${login.token}`}})).json() as {online:{rank:number;points:number}[];summary:{games:number}};
  assert.equal(records.online[0].rank,2);assert.equal(records.online[0].points,0);assert.equal(records.summary.games,1);
 }finally{await f.close();rmSync(dir,{recursive:true,force:true})}
});
test('single records are account-isolated, idempotent and cannot change online ranking points',async()=>{
 const f=await open();try{const a=await account(f,'single_one'),b=await account(f,'single_two');const headers={'Content-Type':'application/json',Authorization:`Bearer ${a.token}`};
  const record={id:'12345678-1234-4123-8123-123456789abc',rank:2,players:2,turns:10,character:'mage',forfeited:true};
  for(let i=0;i<2;i++)assert.equal((await fetch(f.url+'/api/account/single-record',{method:'POST',headers,body:JSON.stringify({...record,userId:b.user.id,points:99999})})).status,200);
  const records=await (await fetch(f.url+'/api/account/records',{headers})).json() as {single:{rank:number}[];summary:{games:number;points:number}};assert.equal(records.single.length,1);assert.equal(records.single[0].rank,2);assert.equal(records.summary.games,0);assert.equal(records.summary.points,0);
  assert.equal(f.server.store.singleHistory(b.user.id).length,0);assert.equal(f.server.store.leaderboard().length,0);
  assert.equal((await fetch(f.url+'/api/account/single-record',{method:'POST',headers,body:JSON.stringify({...record,rank:1})})).status,400);
  const login=await (await signIn(f,'single_one')).json() as typeof a;assert.equal((await (await fetch(f.url+'/api/account/records',{headers:{Authorization:`Bearer ${login.token}`}})).json()).single.length,1);
 }finally{await f.close()}
});
test('registering an existing guest links the same user and keeps previous online history',async()=>{
 const f=await open();try{const {clients,users}=await setupRoom(f,2);await start(clients);await request(clients[1],'exit');const upgraded=await account(f,'guest_upgraded','새 닉네임',users[1].token);
  assert.equal(upgraded.user.id,users[1].id);assert.equal(f.server.store.history(upgraded.user.id).length,1);assert.equal(f.server.store.user(users[1].token),null);assert.equal(f.server.store.user(upgraded.token)!.name,'새 닉네임');
 }finally{await f.close()}
});
test('expired sessions reject HTTP and socket actions, and repeated credential attempts are limited',async()=>{
 const f=await open();try{const a=await account(f,'expiring_user'),socket=await f.connect(a.token);f.server.store.db.prepare('UPDATE auth_sessions SET expires_at=0').run();assert.equal((await fetch(f.url+'/api/auth/me',{headers:{Authorization:`Bearer ${a.token}`}})).status,401);assert.equal((await request(socket,'create',{capacity:2})).ok,false);
  let limited=false;for(let i=0;i<25;i++){const response=await signIn(f,'expiring_user','bad');if(response.status===429){limited=true;break;}}assert.equal(limited,true);
 }finally{await f.close()}
});
test('three-player exit removes a selection participant and finished players leave without losing rank',async()=>{
 const f=await open();try{const {clients}=await setupRoom(f,3);await start(clients);assert.equal((await request(clients[0],'exit')).ok,true);let room=await snapshot(clients[1]);assert.equal(room.state!.selection!.player,1);assert.deepEqual(room.state!.forfeited,[0]);
  assert.equal((await request(clients[1],'exit')).ok,true);room=await snapshot(clients[2]);assert.deepEqual(room.state!.ranks,[2,1,0]);assert.equal(f.server.store.history(room.members[0].id).length,1);
 }finally{await f.close()}
 const g=await open();try{const {clients}=await setupRoom(g,3);await start(clients);const room=[...g.server.rooms.values()][0];room.state!.ranks=[0];assert.equal((await request(clients[0],'exit')).ok,true);assert.deepEqual(room.state!.ranks,[0]);assert.equal(room.state!.forfeited.includes(0),false);
 }finally{await g.close()}
});
test('room directory hides passwords, enforces locked joins and broadcasts occupancy and match status',async()=>{
 const f=await open();try{const users=[],clients=[];for(let i=0;i<3;i++){const u=await f.session(`목록${i}`);users.push(u);clients.push(await f.connect(u.token));}
  let latest:unknown[]=[];clients[2].on('rooms',list=>latest=list);
  const made=await request(clients[0],'create',{capacity:2,title:'친구들의 비밀방',password:'room-secret-24',character:'echidna'});assert.equal(made.ok,true,made.error);const code=made.room!.code;
  assert.equal('passwordHash' in made.room!,false);assert.equal('passwordSalt' in made.room!,false);assert.equal(JSON.stringify(f.server.store.rooms()).includes('room-secret-24'),false);
  const listed=await request(clients[2],'rooms') as Reply&{rooms:{code:string;title:string;locked:boolean;count:number;status:string}[]};assert.equal(listed.rooms[0].title,'친구들의 비밀방');assert.equal(listed.rooms[0].locked,true);assert.equal(listed.rooms[0].count,1);assert.equal(JSON.stringify(listed.rooms).includes('password'),false);
  assert.equal((await request(clients[1],'join',{code})).ok,false);assert.equal((await request(clients[1],'join',{code,password:'wrong'})).ok,false);
  assert.equal((await request(clients[1],'join',{code,password:'room-secret-24',character:'galatur'})).ok,true);
  await new Promise(r=>setTimeout(r,10));assert.equal((latest[0] as {status:string}).status,'full');assert.equal((await request(clients[2],'join',{code,password:'room-secret-24'})).ok,false);
  await start(clients.slice(0,2));assert.equal(((await request(clients[2],'rooms')) as unknown as {rooms:{status:string}[]}).rooms[0].status,'playing');assert.deepEqual((await snapshot(clients[0])).state!.players.map(p=>p.character),['echidna','galatur']);
  await request(clients[1],'exit');assert.deepEqual(((await request(clients[2],'rooms')) as unknown as {rooms:unknown[]}).rooms,[]);
 }finally{await f.close()}
});
test('simultaneous password joins cannot overfill the last seat; room password survives restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yutverse-lobby-')),db=join(dir,'game.sqlite');let f=await open(db);
 try{const users=[];for(let i=0;i<3;i++)users.push(await f.session(`동시${i}`));const clients=[];for(const user of users)clients.push(await f.connect(user.token));const made=await request(clients[0],'create',{capacity:2,title:'동시 입장',password:'lock-secret'}),code=made.room!.code;
  await f.close();f=await open(db);const restored=[];for(const user of users)restored.push(await f.connect(user.token));assert.equal((await request(restored[1],'join',{code,password:'bad'})).ok,false);
  const results=await Promise.all([request(restored[1],'join',{code,password:'lock-secret'}),request(restored[2],'join',{code,password:'lock-secret'})]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal((await snapshot(restored[0])).members.length,2);
  const room=[...f.server.rooms.values()][0];assert.ok(room.passwordHash);assert.equal('passwordHash' in await snapshot(restored[0]),false);
 }finally{await f.close();rmSync(dir,{recursive:true,force:true})}
});
test('recovery codes find IDs, reset passwords exactly once, and revoke all old sessions',async()=>{
 const f=await open();try{
  const r=await fetch(f.url+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:'recover_me',password:'original-password',nickname:'복구여행자'})});assert.equal(r.status,201);const a=await r.json() as {token:string;recoveryCode:string;user:{id:string}};
  assert.ok(a.recoveryCode);assert.equal(JSON.stringify(f.server.store.db.prepare('SELECT * FROM account_recovery').all()).includes(a.recoveryCode.replaceAll('-','').toLowerCase()),false);
  const post=(path:string,data:object)=>fetch(f.url+'/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await post('recover-id',{code:'bad-code'})).status,400);const found=await (await post('recover-id',{code:a.recoveryCode.toLowerCase()})).json();assert.deepEqual(found,{login:'recover_me',nickname:'복구여행자'});
  const second=await (await signIn(f,'recover_me','original-password')).json() as {token:string};const socket=await f.connect(second.token);
  const resets=await Promise.all([post('reset-password',{code:a.recoveryCode,password:'new-password-one'}),post('reset-password',{code:a.recoveryCode,password:'new-password-two'})]);assert.deepEqual(resets.map(r=>r.status).sort(),[200,400]);const winner=resets[0].status===200?0:1;const next=await resets[winner].json() as {recoveryCode:string};assert.notEqual(next.recoveryCode,a.recoveryCode);
  assert.equal(f.server.store.user(a.token),null);assert.equal(f.server.store.user(second.token),null);await new Promise(r=>setTimeout(r,20));assert.equal(socket.connected,false);
  assert.equal((await signIn(f,'recover_me','original-password')).status,401);assert.equal((await signIn(f,'recover_me',winner===0?'new-password-one':'new-password-two')).status,200);
  assert.equal((await post('recover-id',{code:a.recoveryCode})).status,400);assert.equal((await post('recover-id',{code:next.recoveryCode})).status,200);
 }finally{await f.close()}
});
test('legacy accounts can issue a recovery code only with their current password; remember changes session lifetime',async()=>{
 const f=await open();try{const a=await account(f,'legacy_recovery');f.server.store.db.prepare('DELETE FROM account_recovery WHERE user_id=?').run(a.user.id);
  const issue=(password:string,token=a.token)=>fetch(f.url+'/api/auth/recovery-code',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({password})});
  assert.equal((await issue('incorrect-password')).status,401);assert.equal((await issue('a-test-password-24','bad')).status,401);const issued=await (await issue('a-test-password-24')).json() as {recoveryCode:string};assert.equal(f.server.store.recoveryAccount(issued.recoveryCode)!.user_id,a.user.id);assert.ok(f.server.store.user(a.token));
  const changed=await (await issue('a-test-password-24')).json() as {recoveryCode:string};assert.equal(f.server.store.recoveryAccount(issued.recoveryCode),null);assert.ok(f.server.store.recoveryAccount(changed.recoveryCode));
  const short=await fetch(f.url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:'legacy_recovery',password:'a-test-password-24',remember:false})});assert.equal(short.status,200);
  const times=f.server.store.db.prepare('SELECT expires_at FROM auth_sessions').all().map(r=>Number(r.expires_at)-Date.now());assert.ok(times.some(t=>t>11*3600000&&t<=12*3600000));assert.ok(times.some(t=>t>29*86400000&&t<=30*86400000));
 }finally{await f.close()}
});
test('duplicate basic-card selection is rejected without charging or recording an event',async()=>{
 const f=await open();try{const {clients}=await setupRoom(f,2);await start(clients);await chooseInitial(clients);const room=[...f.server.rooms.values()][0],owned=room.state!.players[0].slots[0].id;pace(f);room.state!.phase='augment';room.state!.selection={player:0,offers:[owned],queue:[],deadline:f.clock.time+60000};assert.equal((await action(clients[0],'choose',{id:owned})).ok,false);assert.equal(f.server.store.db.prepare('SELECT COUNT(*) AS n FROM augment_choice_events').get()!.n,2);
 }finally{await f.close()}
});
test('server authorizes candidate rerolls and persists the spent reroll across sync',async()=>{
 const f=await open();try{const {clients}=await setupRoom(f,2);await start(clients);assert.equal((await action(clients[1],'reroll-augments')).ok,false);const before=await snapshot(clients[0]);assert.equal((await action(clients[0],'reroll-augments')).ok,true);const after=await snapshot(clients[0]);assert.equal(after.state!.selection!.rerolled,true);assert.equal(after.state!.selection!.deadline,before.state!.selection!.deadline);assert.equal((await action(clients[0],'reroll-augments')).ok,false);
 }finally{await f.close()}
});
test('rooms persist the chosen game style and start server-authoritative mode-specific offers',async()=>{
 for(const gameStyle of ['normal','augment'] as const){const f=await open();try{
  const a=await f.connect((await f.session('방장')).token),b=await f.connect((await f.session('참가자')).token);
  assert.equal((await request(a,'create',{capacity:2,gameStyle:'invalid'})).ok,false);
  const made=await request(a,'create',{capacity:2,gameStyle});assert.equal(made.ok,true,made.error);assert.equal(made.room!.gameStyle,gameStyle);
  assert.equal((await request(b,'join',{code:made.room!.code,gameStyle:gameStyle==='normal'?'augment':'normal'})).ok,true);
  await start([a,b]);const room=await snapshot(a);assert.equal(room.state!.gameStyle,gameStyle);assert.equal(room.gameStyle,gameStyle);
  const offers=room.state!.selection!.offers;assert.equal(offers.length,3);
  if(gameStyle==='normal')assert.deepEqual([...offers].sort(),['back-guard','boost','shield']);
  else assert.ok(offers.some(id=>!['back-guard','boost','shield'].includes(id)));
  const saved=f.server.store.db.prepare('SELECT data FROM rooms WHERE code=?').get(made.room!.code) as {data:string};assert.equal(JSON.parse(saved.data).state.gameStyle,gameStyle);
 }finally{await f.close();}}
});

test('ability prompts enforce owner/voter permissions, secret bluff results and timeout progress',async()=>{
 const f=await open();try{const {clients}=await setupRoom(f,2);await start(clients);const room=[...f.server.rooms.values()][0];room.state=createGame(2,false,()=>.5,f.clock.time,[],'augment');room.state.players[0].slots=[{id:'custom-bluff',remaining:2}];room.state.players[0].stats={forceReady:1,forced:1};
 assert.equal((await action(clients[0],'use',{id:'custom-bluff'})).ok,true);assert.equal((await action(clients[1],'resolve-ability',{value:'5'})).ok,false);assert.equal((await action(clients[0],'resolve-ability',{value:'5'})).ok,true);assert.equal((await action(clients[0],'throw')).ok,true);
 const owner=await snapshot(clients[0]),other=await snapshot(clients[1]);assert.equal((owner.state!.special!.prompt!.data!.actual as {steps:number}).steps,1);assert.equal(other.state!.special!.prompt!.data,undefined);assert.equal(other.state!.lastThrow!.result.name,'비공개');assert.deepEqual(other.state!.pendingResults,[]);assert.equal((await action(clients[0],'resolve-ability',{value:'truth'})).ok,false);assert.equal((await action(clients[1],'resolve-ability',{value:'lie'})).ok,true);assert.equal((await snapshot(clients[1])).state!.turn,1);
 room.state=createGame(2,false,()=>.5,f.clock.time,[],'augment');room.state.players[0].slots=[{id:'custom-quick-hands',remaining:1}];pace(f);await action(clients[0],'use',{id:'custom-quick-hands'});f.clock.time+=60000;f.server.tick();assert.equal(room.state.special?.prompt,undefined);assert.equal(room.state.players[0].stats!.forceReady,1);
 }finally{await f.close()}
});
test('fog omits distant coordinates and shared winners receive equal permanent rank points',async()=>{
 const f=await open();try{const {clients}=await setupRoom(f,4);await start(clients);const room=[...f.server.rooms.values()][0];room.state=createGame(4,false,()=>.5,0,[],'augment');room.state.players[0].pieces[0]={node:'o1',history:['home']};room.state.players[1].pieces[0]={node:'o10',history:['home']};room.state.special={fogOwner:1,fogUntil:3};const view=await snapshot(clients[0]);assert.equal(view.state!.players[1].pieces[0].node,'hidden');assert.deepEqual(view.state!.players[1].pieces[0].history,[]);
 room.state.special={placements:{0:1,1:1,2:3,3:4},wins:[[0,1]]};room.state.ranks=[0,1,2,3];room.state.phase='over';f.server.store.saveRoom(room);const rows=f.server.store.db.prepare('SELECT rank,points FROM participants ORDER BY rank').all();assert.deepEqual(rows.map(r=>[r.rank,r.points]),[[1,40],[1,40],[3,5],[4,0]]);
 }finally{await f.close()}
});
