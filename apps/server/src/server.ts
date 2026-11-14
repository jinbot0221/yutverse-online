import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {randomInt,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {createGame,throwYut,move,legalRoutes,selectResult,selectAugment,useAugment,skipMove,expireSelection,forfeit,type State} from '@yutverse/engine';
import {Store} from './store.ts';
export type Member={id:string;name:string;ready:boolean;connected:boolean;disconnectedAt:number|null;departed?:boolean};
export type Room={code:string;matchId:string;capacity:2|3|4;owner:string;members:Member[];state:State|null;revision:number;actionDeadline:number|null;createdAt:number};
type Options={dbPath:string;random?:()=>number;now?:()=>number;graceMs?:number;turnMs?:number;staticDir?:string;webOrigin?:string};
export function createGameServer(options:Options){
 const store=new Store(options.dbPath),app=express(),http=createServer(app);
 const now=options.now||Date.now,random=options.random||(()=>randomInt(0,0x100000000)/0x100000000),grace=options.graceMs??90000,turnMs=options.turnMs??120000;
 const io=new Server(http,{maxHttpBufferSize:8192,allowRequest:(req,callback)=>{const origin=req.headers.origin;callback(null,!origin||origin===options.webOrigin||origin===`http://${req.headers.host}`||origin===`https://${req.headers.host}`);}});
 const rooms=new Map<string,Room>(),sessions=new Map<string,string>(),limits=new Map<string,{count:number;until:number}>();
 const limit=(key:string,max:number,window=10000)=>{const t=now();let l=limits.get(key);if(!l||l.until<=t){l={count:0,until:t+window};limits.set(key,l);}return ++l.count<=max;};
 app.use(express.json({limit:'2kb'}));
 app.get('/api/health',(_req,res)=>res.json({ok:true}));
 app.post('/api/session',(req,res)=>{
  if(!limit(`http:${req.socket.remoteAddress}`,20,60000))return void res.status(429).json({error:'잠시 후 다시 시도하세요.'});
  if(typeof req.body?.name!=='string'||req.body.name.trim().length<1||req.body.name.trim().length>16)return void res.status(400).json({error:'이름은 1~16자입니다.'});
  res.status(201).json(store.createUser(req.body.name.trim()));
 });
 app.get('/api/ranking',(req,res)=>{const season=typeof req.query.season==='string'?req.query.season:undefined;if(season&&!/^\d{4}-\d{2}$/.test(season))return void res.status(400).json({error:'시즌 형식: YYYY-MM'});res.json(store.leaderboard(season));});
 app.get('/api/history',(req,res)=>{const user=store.user(req.headers.authorization?.replace(/^Bearer /,''));if(!user)return void res.status(401).json({error:'세션이 필요합니다.'});res.json(store.history(user.id));});
 if(options.staticDir){app.use(express.static(options.staticDir));app.get('/{*path}',(_req,res)=>res.sendFile(resolve(options.staticDir!,'index.html')));}
 const publicRoom=(room:Room,userId:string)=>{
  const state=room.state?structuredClone(room.state):null;
  if(state?.selection&&room.members[state.selection.player].id!==userId)state.selection.offers=[];
  return {...room,state,members:room.members.map(({disconnectedAt,...m})=>m),me:room.members.findIndex(m=>m.id===userId)};
 };
 function publish(room:Room){room.revision++;store.saveRoom(room);for(const member of room.members){const sid=sessions.get(member.id);if(sid&&!member.departed)io.to(sid).emit('room',publicRoom(room,member.id));}}
 function apply(room:Room,state:State){if(state===room.state)return false;room.state=state;room.actionDeadline=['over','augment'].includes(state.phase)?null:now()+turnMs;publish(room);return true;}
 function removeLobby(room:Room,id:string){room.members=room.members.filter(m=>m.id!==id);if(!room.members.length){rooms.delete(room.code);store.removeRoom(room.code);return;}if(room.owner===id)room.owner=room.members[0].id;publish(room);}
 function findRoom(id:string){return [...rooms.values()].find(r=>r.members.some(m=>m.id===id&&!m.departed)&&(r.state?.phase!=='over'));}
 for(const raw of store.rooms()){
  const r=raw as Room;for(const m of r.members){m.connected=false;m.disconnectedAt=now();}
  if(r.state?.phase!=='over'){r.actionDeadline=r.state?.phase==='augment'?null:now()+turnMs;rooms.set(r.code,r);store.saveRoom(r);}
 }
 function tick(){
  for(const [key,l] of limits)if(l.until<now())limits.delete(key);
  for(const room of [...rooms.values()]){
   if(room.state?.phase==='over'){
    if(room.members.every(m=>!m.connected)&&now()-room.createdAt>300000){rooms.delete(room.code);store.removeRoom(room.code);}continue;
   }
   for(const member of [...room.members])if(!member.connected&&member.disconnectedAt!==null&&now()-member.disconnectedAt>=grace){
    if(room.state)apply(room,forfeit(room.state,room.members.findIndex(m=>m.id===member.id),random,now()));else removeLobby(room,member.id);
   }
   if(!room.state)continue;
   apply(room,expireSelection(room.state,now(),random));
   if((room.state as State).phase!=='over'&&room.actionDeadline!==null&&now()>=room.actionDeadline)apply(room,forfeit(room.state,room.state.turn,random,now()));
  }
 }
 const timer=setInterval(()=>{try{tick()}catch(error){console.error('Room timer failed',error instanceof Error?error.message:'unknown');}},500);timer.unref();
 io.use((socket,next)=>{const user=store.user(socket.handshake.auth?.token);if(!user)return next(new Error('유효한 세션이 필요합니다.'));socket.data.user=user;next();});
 io.on('connection',socket=>{
  const user=socket.data.user as {id:string;name:string};const old=sessions.get(user.id);sessions.set(user.id,socket.id);if(old)io.sockets.sockets.get(old)?.disconnect(true);
  for(const room of rooms.values()){const member=room.members.find(m=>m.id===user.id&&!m.departed);if(member){member.connected=true;member.disconnectedAt=null;publish(room);}}
  socket.emit('identity',user);
  function handle(event:string,fn:(data:Record<string,unknown>)=>unknown){socket.on(event,(input,ack)=>{const reply=typeof ack==='function'?ack:()=>{};try{
   if(sessions.get(user.id)!==socket.id)throw Error('세션이 다른 창에서 연결되었습니다.');
   if(!limit(`socket:${user.id}`,40))throw Error('요청이 너무 빠릅니다.');
   if(input!==undefined&&(input===null||typeof input!=='object'||Array.isArray(input)))throw Error('요청 형식이 잘못되었습니다.');
   tick();const value=fn(input||{});reply({ok:true,...(value as object||{})});
  }catch(error){reply({ok:false,error:error instanceof Error?error.message:'요청에 실패했습니다.'});}});}
  function roomFor(){const r=[...rooms.values()].find(r=>r.members.some(m=>m.id===user.id&&!m.departed)&&r.state?.phase!=='over')||[...rooms.values()].find(r=>r.members.some(m=>m.id===user.id&&!m.departed));if(!r)throw Error('참가 중인 방이 없습니다.');return r;}
  handle('create',data=>{
   if(findRoom(user.id))throw Error('이미 참가 중인 방이 있습니다.');for(const old of rooms.values())if(old.state?.phase==='over'){const member=old.members.find(m=>m.id===user.id);if(member)member.departed=true;}if(data.capacity!==2&&data.capacity!==3&&data.capacity!==4)throw Error('2~4인 방만 지원합니다.');
   if(rooms.size>=200)throw Error('방이 가득 찼습니다.');
   let code='';do{code=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');}while(rooms.has(code));
   const room:Room={code,matchId:randomUUID(),capacity:data.capacity,owner:user.id,members:[{...user,ready:false,connected:true,disconnectedAt:null}],state:null,revision:0,actionDeadline:null,createdAt:now()};rooms.set(code,room);publish(room);return {room:publicRoom(room,user.id)};
  });
  handle('join',data=>{
   if(typeof data.code!=='string'||!/^[A-Z2-9]{6}$/.test(data.code))throw Error('초대 코드를 확인하세요.');
   if(findRoom(user.id))throw Error('이미 참가 중인 방이 있습니다.');for(const old of rooms.values())if(old.state?.phase==='over'){const member=old.members.find(m=>m.id===user.id);if(member)member.departed=true;}const room=rooms.get(data.code);if(!room||room.state||room.members.length>=room.capacity)throw Error('참가할 수 없는 방입니다.');
   room.members.push({...user,ready:false,connected:true,disconnectedAt:null});publish(room);return {room:publicRoom(room,user.id)};
  });
  handle('sync',()=>{const room=roomFor();return {room:publicRoom(room,user.id)};});
  handle('ready',()=>{const room=roomFor();if(room.state)throw Error('이미 시작된 경기입니다.');const m=room.members.find(m=>m.id===user.id)!;m.ready=!m.ready;publish(room);});
  handle('start',()=>{const room=roomFor();if(room.owner!==user.id||room.state||room.members.length!==room.capacity||room.members.some(m=>!m.ready||!m.connected))throw Error('방장만 모두 준비된 경기를 시작할 수 있습니다.');const s=createGame(room.capacity,true,random,now());s.players.forEach((p,i)=>p.name=room.members[i].name);apply(room,s);});
  handle('act',data=>{
   const room=roomFor(),state=room.state,index=room.members.findIndex(m=>m.id===user.id);if(!state||state.phase==='over')throw Error('진행 중인 경기가 없습니다.');
   if(data.revision!==room.revision)throw Error('상태가 갱신되었습니다. 다시 시도하세요.');
   let next=state;
   if(data.kind==='forfeit')next=forfeit(state,index,random,now());
   else if(data.kind==='choose'&&typeof data.id==='string')next=selectAugment(state,index,data.id,random,now());
   else if(index===state.turn){
    if(data.kind==='throw')next=throwYut(state,random,now());
    if(data.kind==='select-result'&&Number.isInteger(data.id))next=selectResult(state,data.id as number);
    if(data.kind==='move'&&Number.isInteger(data.index)){const routes=legalRoutes(state,data.index as number);const route=routes.find(r=>r.id===data.route)?.id;if((!routes.length&&data.route===undefined)||(routes.length&&route))next=move(state,data.index as number,random,now(),route);}
    if(data.kind==='use'&&typeof data.id==='string')next=useAugment(state,index,data.id,random,now());
    if(data.kind==='skip')next=skipMove(state,random,now());
   }
   if(!apply(room,next))throw Error('현재 사용할 수 없는 행동입니다.');
  });
  handle('leave',()=>{const room=roomFor();if(room.state&&room.state.phase!=='over')throw Error('경기 중에는 먼저 기권하세요.');if(!room.state)removeLobby(room,user.id);else{room.members.find(m=>m.id===user.id)!.departed=true;publish(room);}socket.emit('left');});
  socket.on('disconnect',()=>{if(sessions.get(user.id)!==socket.id)return;sessions.delete(user.id);for(const room of rooms.values()){const member=room.members.find(m=>m.id===user.id&&!m.departed);if(member){member.connected=false;member.disconnectedAt=now();publish(room);}}});
 });
 return {app,http,io,store,rooms,tick,async close(){clearInterval(timer);await new Promise<void>(r=>io.close(()=>r()));if(http.listening)await new Promise<void>(r=>http.close(()=>r()));store.close();}};
}
