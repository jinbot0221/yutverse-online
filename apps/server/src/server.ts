import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {randomInt,randomUUID,randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const digestPassword=promisify(scrypt);
import {resolve} from 'node:path';
import {createGame,throwYut,move,legalRoutes,selectResult,selectAugment,useAugment,skipMove,expireSelection,forfeit,DEFAULT_CHARACTER,isCharacterId,type CharacterId,type State} from '@yutverse/engine';
import {Store} from './store.ts';
export type Member={id:string;name:string;ready:boolean;connected:boolean;disconnectedAt:number|null;departed?:boolean;character?:CharacterId};
export type Room={code:string;matchId:string;capacity:2|3|4;owner:string;members:Member[];state:State|null;revision:number;actionDeadline:number|null;createdAt:number;title?:string;passwordSalt?:string;passwordHash?:string};
export type RoomListEntry={code:string;title:string;capacity:2|3|4;count:number;ownerName:string;locked:boolean;status:'waiting'|'full'|'playing'};
type Options={dbPath:string;random?:()=>number;now?:()=>number;graceMs?:number;turnMs?:number;staticDir?:string;webOrigin?:string};
export function createGameServer(options:Options){
 const store=new Store(options.dbPath),app=express(),http=createServer(app);
 const now=options.now||Date.now,random=options.random||(()=>randomInt(0,0x100000000)/0x100000000),grace=options.graceMs??90000,turnMs=options.turnMs??120000;
 const io=new Server(http,{maxHttpBufferSize:8192,allowRequest:(req,callback)=>{const origin=req.headers.origin;callback(null,!origin||origin===options.webOrigin||origin===`http://${req.headers.host}`||origin===`https://${req.headers.host}`);}});
 const rooms=new Map<string,Room>(),sessions=new Map<string,string>(),limits=new Map<string,{count:number;until:number}>();
 const limit=(key:string,max:number,window=10000)=>{const t=now();let l=limits.get(key);if(!l||l.until<=t){l={count:0,until:t+window};limits.set(key,l);}return ++l.count<=max;};
 app.use(express.json({limit:'2kb'}));
 app.get('/api/health',(_req,res)=>res.json({ok:true}));
 const bearer=(req:express.Request)=>req.headers.authorization?.replace(/^Bearer /,'');
 app.use('/api/auth',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
 app.post('/api/auth/register',async(req,res)=>{
  if(!limit(`auth:${req.socket.remoteAddress}`,20,60000))return void res.status(429).json({error:'잠시 후 다시 시도하세요.'});
  const {login,password,nickname}=req.body||{};
  if(req.body?.remember!==undefined&&typeof req.body.remember!=='boolean')return void res.status(400).json({error:'로그인 유지 설정이 잘못되었습니다.'});
  if(typeof login!=='string'||!/^[a-zA-Z0-9_]{4,24}$/.test(login))return void res.status(400).json({error:'아이디는 영문·숫자·밑줄 4~24자입니다.'});
  if(typeof password!=='string'||password.length<8||password.length>128)return void res.status(400).json({error:'비밀번호는 8~128자입니다.'});
  if(typeof nickname!=='string'||!nickname.trim()||nickname.trim().length>16)return void res.status(400).json({error:'닉네임은 1~16자입니다.'});
  const guest=store.user(bearer(req));if(guest?.login)return void res.status(409).json({error:'다른 계정을 만들려면 먼저 로그아웃하세요.'});
  try{res.status(201).json(await store.register(login.toLowerCase(),password,nickname.trim(),guest,req.body.remember!==false));}catch(error){const duplicate=error instanceof Error&&error.message==='이미 사용 중인 아이디입니다.';res.status(duplicate?409:500).json({error:duplicate?'이미 사용 중인 아이디입니다.':'회원가입을 완료하지 못했습니다. 잠시 후 다시 시도하세요.'});}
 });
 app.post('/api/auth/login',async(req,res)=>{
  if(!limit(`auth:${req.socket.remoteAddress}`,20,60000))return void res.status(429).json({error:'잠시 후 다시 시도하세요.'});
  const {login,password}=req.body||{};
  if(req.body?.remember!==undefined&&typeof req.body.remember!=='boolean')return void res.status(400).json({error:'로그인 유지 설정이 잘못되었습니다.'});
  if(typeof login!=='string'||!/^[a-zA-Z0-9_]{4,24}$/.test(login)||typeof password!=='string'||password.length<8||password.length>128)return void res.status(401).json({error:'아이디 또는 비밀번호를 확인하세요.'});
  const account=await store.login(login.toLowerCase(),password,req.body.remember!==false);if(!account)return void res.status(401).json({error:'아이디 또는 비밀번호를 확인하세요.'});res.json(account);
 });
 app.post('/api/auth/recover-id',(req,res)=>{if(!limit(`recovery:${req.socket.remoteAddress}`,8,60000))return void res.status(429).json({error:'잠시 후 다시 시도하세요.'});const account=store.recoveryAccount(req.body?.code);if(!account)return void res.status(400).json({error:'복구코드를 확인하세요.'});res.json({login:account.login,nickname:account.name});});
 app.post('/api/auth/reset-password',async(req,res)=>{if(!limit(`recovery:${req.socket.remoteAddress}`,8,60000))return void res.status(429).json({error:'잠시 후 다시 시도하세요.'});if(typeof req.body?.code!=='string'||typeof req.body?.password!=='string'||req.body.password.length<8||req.body.password.length>128)return void res.status(400).json({error:'복구코드와 8~128자의 새 비밀번호를 입력하세요.'});const result=await store.resetPassword(req.body.code,req.body.password);if(!result)return void res.status(400).json({error:'복구코드를 확인하세요.'});io.sockets.sockets.get(sessions.get(result.id)||'')?.disconnect(true);res.json({login:result.login,recoveryCode:result.recoveryCode});});
 app.post('/api/auth/recovery-code',async(req,res)=>{const token=bearer(req),user=store.user(token);if(!user?.login)return void res.status(401).json({error:'로그인이 필요합니다.'});if(!limit(`issue-recovery:${user.id}`,5,60000))return void res.status(429).json({error:'잠시 후 다시 시도하세요.'});if(typeof req.body?.password!=='string'||req.body.password.length<8||req.body.password.length>128)return void res.status(400).json({error:'현재 비밀번호를 입력하세요.'});const checked=await store.login(user.login,req.body.password,false);if(!checked)return void res.status(401).json({error:'현재 비밀번호를 확인하세요.'});store.revoke(checked.token);if(!store.user(token))return void res.status(401).json({error:'다시 로그인하세요.'});res.json({recoveryCode:store.issueRecovery(user.id)});});
 app.get('/api/auth/me',(req,res)=>{const user=store.user(bearer(req));if(!user)return void res.status(401).json({error:'다시 로그인하세요.'});res.json({user});});
 app.post('/api/auth/logout',(req,res)=>{
  const token=bearer(req),user=store.user(token);if(!user||!token)return void res.status(401).json({error:'다시 로그인하세요.'});
  if(findRoom(user.id))return void res.status(409).json({error:'먼저 게임이나 대기실에서 나가주세요.'});
  store.revoke(token);const socket=io.sockets.sockets.get(sessions.get(user.id)||'');if(socket?.handshake.auth.token===token)socket.disconnect(true);res.json({ok:true});
 });
 app.get('/api/account/records',(req,res)=>{
  res.setHeader('Cache-Control','no-store');const user=store.user(bearer(req));if(!user?.login)return void res.status(401).json({error:'로그인이 필요합니다.'});
  res.json({online:store.history(user.id),single:store.singleHistory(user.id),summary:store.summary(user.id)});
 });
 app.post('/api/account/single-record',(req,res)=>{
  const user=store.user(bearer(req));if(!user?.login)return void res.status(401).json({error:'로그인이 필요합니다.'});
  if(!limit(`single-record:${user.id}`,100,60000))return void res.status(429).json({error:'잠시 후 다시 시도하세요.'});
  const r=req.body;
  if(!r||typeof r.id!=='string'||!/^[a-f0-9-]{36}$/.test(r.id)||![2,3,4].includes(r.players)||!Number.isInteger(r.rank)||r.rank<1||r.rank>r.players||!Number.isInteger(r.turns)||r.turns<1||r.turns>100000||!isCharacterId(r.character)||typeof r.forfeited!=='boolean'||(r.forfeited&&r.rank!==r.players))return void res.status(400).json({error:'싱글 전적 형식이 잘못되었습니다.'});
  store.saveSingle(user.id,r);res.json({ok:true});
 });
 app.post('/api/session',(req,res)=>{
  if(!limit(`http:${req.socket.remoteAddress}`,20,60000))return void res.status(429).json({error:'잠시 후 다시 시도하세요.'});
  if(typeof req.body?.name!=='string'||req.body.name.trim().length<1||req.body.name.trim().length>16)return void res.status(400).json({error:'이름은 1~16자입니다.'});
  res.status(201).json(store.createUser(req.body.name.trim()));
 });
 app.get('/api/ranking',(req,res)=>{const season=typeof req.query.season==='string'?req.query.season:undefined;if(season&&!/^\d{4}-\d{2}$/.test(season))return void res.status(400).json({error:'시즌 형식: YYYY-MM'});res.json(store.leaderboard(season));});
 app.get('/api/history',(req,res)=>{res.setHeader('Cache-Control','no-store');const user=store.user(req.headers.authorization?.replace(/^Bearer /,''));if(!user)return void res.status(401).json({error:'세션이 필요합니다.'});res.json(store.history(user.id));});
 if(options.staticDir){app.use(express.static(options.staticDir));app.get('/{*path}',(_req,res)=>res.sendFile(resolve(options.staticDir!,'index.html')));}
 const publicRoom=(room:Room,userId:string)=>{
  const state=room.state?structuredClone(room.state):null;
  if(state?.selection&&room.members[state.selection.player].id!==userId)state.selection.offers=[];
  const {passwordHash,passwordSalt,...visible}=room;
  return {...visible,title:room.title||`${room.members.find(m=>m.id===room.owner)?.name||'여행자'}의 윷놀이`,locked:Boolean(passwordHash),state,members:room.members.map(({disconnectedAt,...m})=>m),me:room.members.findIndex(m=>m.id===userId)};
 };
 function directory():RoomListEntry[]{return [...rooms.values()].filter(r=>r.state?.phase!=='over').sort((a,b)=>Number(Boolean(a.state))-Number(Boolean(b.state))||b.createdAt-a.createdAt).map(r=>({code:r.code,title:r.title||`${r.members.find(m=>m.id===r.owner)?.name||'여행자'}의 윷놀이`,capacity:r.capacity,count:r.members.filter(m=>!m.departed).length,ownerName:r.members.find(m=>m.id===r.owner)?.name||'여행자',locked:Boolean(r.passwordHash),status:r.state?'playing':r.members.length>=r.capacity?'full':'waiting'}));}
 let directorySnapshot='';function broadcastDirectory(){const list=directory(),snapshot=JSON.stringify(list);if(snapshot!==directorySnapshot){directorySnapshot=snapshot;io.emit('rooms',list);}}
 function publish(room:Room){room.revision++;store.saveRoom(room);for(const member of room.members){const sid=sessions.get(member.id);if(sid&&!member.departed)io.to(sid).emit('room',publicRoom(room,member.id));}broadcastDirectory();}
 function apply(room:Room,state:State){if(state===room.state)return false;room.state=state;room.actionDeadline=['over','augment'].includes(state.phase)?null:now()+turnMs;publish(room);return true;}
 function removeLobby(room:Room,id:string){room.members=room.members.filter(m=>m.id!==id);if(!room.members.length){rooms.delete(room.code);store.removeRoom(room.code);broadcastDirectory();return;}if(room.owner===id)room.owner=room.members[0].id;publish(room);}
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
 io.use((socket,next)=>{const user=store.user(socket.handshake.auth?.token);if(!user)return next(new Error('유효한 세션이 필요합니다.'));socket.data.user={id:user.id,name:user.name};next();});
 io.on('connection',socket=>{
  const user=socket.data.user as {id:string;name:string};const old=sessions.get(user.id);sessions.set(user.id,socket.id);if(old)io.sockets.sockets.get(old)?.disconnect(true);
  for(const room of rooms.values()){const member=room.members.find(m=>m.id===user.id&&!m.departed);if(member){member.connected=true;member.disconnectedAt=null;publish(room);}}
  socket.emit('identity',user);socket.emit('rooms',directory());
  function handle(event:string,fn:(data:Record<string,unknown>)=>unknown){socket.on(event,async(input,ack)=>{const reply=typeof ack==='function'?ack:()=>{};try{
   if(sessions.get(user.id)!==socket.id)throw Error('세션이 다른 창에서 연결되었습니다.');
   if(!store.user(socket.handshake.auth?.token))throw Error('다시 로그인하세요.');
   if(!limit(`socket:${user.id}`,40))throw Error('요청이 너무 빠릅니다.');
   if(input!==undefined&&(input===null||typeof input!=='object'||Array.isArray(input)))throw Error('요청 형식이 잘못되었습니다.');
   tick();const value=await fn(input||{});reply({ok:true,...(value as object||{})});
  }catch(error){reply({ok:false,error:error instanceof Error?error.message:'요청에 실패했습니다.'});}});}
  function roomFor(){const r=[...rooms.values()].find(r=>r.members.some(m=>m.id===user.id&&!m.departed)&&r.state?.phase!=='over')||[...rooms.values()].find(r=>r.members.some(m=>m.id===user.id&&!m.departed));if(!r)throw Error('참가 중인 방이 없습니다.');return r;}
  handle('rooms',()=>({rooms:directory()}));
  handle('create',async data=>{
   if(data.character!==undefined&&!isCharacterId(data.character))throw Error('선택할 수 없는 캐릭터입니다.');
   if(data.capacity!==2&&data.capacity!==3&&data.capacity!==4)throw Error('2~4인 방만 지원합니다.');
   if(data.title!==undefined&&(typeof data.title!=='string'||data.title.trim().length>32))throw Error('방 제목은 32자 이내입니다.');
   if(data.password!==undefined&&(typeof data.password!=='string'||data.password.length>32))throw Error('방 비밀번호는 32자 이내입니다.');
   const title=typeof data.title==='string'&&data.title.trim()?data.title.trim():`${user.name}의 윷놀이`;
   const password=typeof data.password==='string'?data.password:'';const salt=password?randomBytes(16).toString('hex'):undefined;
   const passwordHash=password?(await digestPassword(password,salt!,64) as Buffer).toString('hex'):undefined;
   if(sessions.get(user.id)!==socket.id||!store.user(socket.handshake.auth?.token))throw Error('다시 연결한 뒤 시도하세요.');
   if(findRoom(user.id))throw Error('이미 참가 중인 방이 있습니다.');
   if(rooms.size>=200)throw Error('방이 가득 찼습니다.');
   for(const old of rooms.values())if(old.state?.phase==='over'){const member=old.members.find(m=>m.id===user.id);if(member)member.departed=true;}
   let code='';do{code=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');}while(rooms.has(code));
   const room:Room={code,title,passwordSalt:salt,passwordHash,matchId:randomUUID(),capacity:data.capacity,owner:user.id,members:[{...user,character:isCharacterId(data.character)?data.character:DEFAULT_CHARACTER,ready:false,connected:true,disconnectedAt:null}],state:null,revision:0,actionDeadline:null,createdAt:now()};rooms.set(code,room);publish(room);return {room:publicRoom(room,user.id)};
  });
  handle('join',async data=>{
   if(data.character!==undefined&&!isCharacterId(data.character))throw Error('선택할 수 없는 캐릭터입니다.');
   if(typeof data.code!=='string'||!/^[A-Z2-9]{6}$/.test(data.code))throw Error('초대 코드를 확인하세요.');
   if(typeof data.password!=='undefined'&&(typeof data.password!=='string'||data.password.length>32))throw Error('방 비밀번호를 확인하세요.');
   const room=rooms.get(data.code);if(!room||room.state||room.members.length>=room.capacity)throw Error('참가할 수 없는 방입니다.');
   if(room.passwordHash){
    if(!limit(`room-password:${user.id}`,8,60000))throw Error('비밀번호를 너무 많이 시도했습니다. 잠시 후 다시 시도하세요.');
    if(typeof data.password!=='string'||!room.passwordSalt)throw Error('방 비밀번호를 입력하세요.');
    const attempt=await digestPassword(data.password,room.passwordSalt,64) as Buffer;
    if(!timingSafeEqual(attempt,Buffer.from(room.passwordHash,'hex')))throw Error('방 비밀번호가 맞지 않습니다.');
   }
   // Another request can change occupancy while the password is being checked.
   if(sessions.get(user.id)!==socket.id||!store.user(socket.handshake.auth?.token))throw Error('다시 연결한 뒤 시도하세요.');
   if(findRoom(user.id))throw Error('이미 참가 중인 방이 있습니다.');
   if(rooms.get(room.code)!==room||room.state||room.members.length>=room.capacity)throw Error('참가할 수 없는 방입니다.');
   for(const old of rooms.values())if(old.state?.phase==='over'){const member=old.members.find(m=>m.id===user.id);if(member)member.departed=true;}
   room.members.push({...user,character:isCharacterId(data.character)?data.character:DEFAULT_CHARACTER,ready:false,connected:true,disconnectedAt:null});publish(room);return {room:publicRoom(room,user.id)};
  });
  handle('sync',()=>{const room=roomFor();return {room:publicRoom(room,user.id)};});
  handle('character',data=>{const room=roomFor();if(room.state)throw Error('경기 중에는 캐릭터를 바꿀 수 없습니다.');if(!isCharacterId(data.character))throw Error('선택할 수 없는 캐릭터입니다.');const member=room.members.find(m=>m.id===user.id)!;member.character=data.character;member.ready=false;publish(room);return {room:publicRoom(room,user.id)};});
  handle('ready',()=>{const room=roomFor();if(room.state)throw Error('이미 시작된 경기입니다.');const m=room.members.find(m=>m.id===user.id)!;m.ready=!m.ready;publish(room);});
  handle('start',()=>{const room=roomFor();if(room.owner!==user.id||room.state||room.members.length!==room.capacity||room.members.some(m=>!m.ready||!m.connected))throw Error('방장만 모두 준비된 경기를 시작할 수 있습니다.');const s=createGame(room.capacity,true,random,now(),room.members.map(m=>m.character??DEFAULT_CHARACTER));s.players.forEach((p,i)=>p.name=room.members[i].name);apply(room,s);});
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
  handle('exit',()=>{const room=roomFor(),index=room.members.findIndex(m=>m.id===user.id);
   if(!room.state)removeLobby(room,user.id);
   else{if(room.state.phase!=='over'&&!room.state.ranks.includes(index)&&!room.state.forfeited.includes(index))apply(room,forfeit(room.state,index,random,now()));room.members[index].departed=true;publish(room);}
   socket.emit('left');
  });
  handle('leave',()=>{const room=roomFor();if(room.state&&room.state.phase!=='over')throw Error('경기 중에는 먼저 기권하세요.');if(!room.state)removeLobby(room,user.id);else{room.members.find(m=>m.id===user.id)!.departed=true;publish(room);}socket.emit('left');});
  socket.on('disconnect',()=>{if(sessions.get(user.id)!==socket.id)return;sessions.delete(user.id);for(const room of rooms.values()){const member=room.members.find(m=>m.id===user.id&&!m.departed);if(member){member.connected=false;member.disconnectedAt=now();publish(room);}}});
 });
 return {app,http,io,store,rooms,tick,async close(){clearInterval(timer);await new Promise<void>(r=>io.close(()=>r()));if(http.listening)await new Promise<void>(r=>http.close(()=>r()));store.close();}};
}
