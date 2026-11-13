import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io,type Socket} from 'socket.io-client';
import {chooseMove,legalMoves,type State} from '@yutverse/engine';
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
async function setupRoom(f:Awaited<ReturnType<typeof open>>,count:3|4){const users=[],clients=[];for(let i=0;i<count;i++){const user=await f.session(`여행자${i+1}`);users.push(user);clients.push(await f.connect(user.token));}
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
for(const count of [3,4] as const)test(`${count}-player authoritative match finishes, broadcasts ranks and persists differential points exactly once`,async()=>{
 const f=await open();try{
  const {clients}=await setupRoom(f,count);await start(clients);let actions=0;
  while(actions++<3000){pace(f);const r=await snapshot(clients[0]),s=r.state!;if(s.phase==='over')break;
   const actor=s.selection?.player??s.turn;const own=await snapshot(clients[actor]);const state=own.state!;
   const reply=state.selection?await action(clients[actor],'choose',{id:state.selection.offers[0]}):state.phase==='throw'?await action(clients[actor],'throw'):legalMoves(state).length?await action(clients[actor],'move',{index:chooseMove(state,'hard')}):await action(clients[actor],'skip');
   assert.equal(reply.ok,true,reply.error);
  }
  const last=await snapshot(clients[0]);assert.equal(last.state!.phase,'over');assert.equal(new Set(last.state!.ranks).size,count);
  for(const c of clients)assert.deepEqual((await snapshot(c)).state!.ranks,last.state!.ranks);
  const rankings=await (await fetch(`${f.url}/api/ranking`)).json() as {points:number}[];
  assert.deepEqual(rankings.map(r=>r.points).sort((a,b)=>b-a),count===3?[30,10,0]:[40,20,5,0]);
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
 try{const {clients,users}=await setupRoom(f,3);await start(clients);await chooseInitial(clients);const before=(await snapshot(clients[0])).state;
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
