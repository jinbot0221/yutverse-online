import {useEffect,useRef,useState} from 'react';
import {io,type Socket} from 'socket.io-client';
import {CHAT_LIMIT,type ChatMessage,type State,type CharacterId} from '@yutverse/engine';
export type AccountUser={id:string;name:string;login:string|null};
export type RoomListEntry={code:string;title:string;capacity:2|3|4;gameStyle?:'normal'|'augment';count:number;ownerName:string;locked:boolean;status:'waiting'|'full'|'playing'};
export type PublicRoom={chat?:ChatMessage[];title?:string;locked?:boolean;code:string;capacity:2|3|4;gameStyle?:'normal'|'augment';owner:string;members:{id:string;name:string;ready:boolean;connected:boolean;character?:CharacterId}[];state:State|null;revision:number;me:number;actionDeadline:number|null};
type Reply={ok:boolean;error?:string;room?:PublicRoom;rooms?:RoomListEntry[]};
function savedToken(){try{return sessionStorage.getItem('yutverse.token')||localStorage.getItem('yutverse.token')||''}catch{return ''}}
function cachedUser():AccountUser|null{try{return JSON.parse(sessionStorage.getItem('yutverse.account')||localStorage.getItem('yutverse.account')||'null')}catch{return null}}
export function useOnline(enabled:boolean){
 const [token,setToken]=useState(savedToken),[user,setUser]=useState(cachedUser),[checking,setChecking]=useState(Boolean(savedToken())),[room,setRoom]=useState<PublicRoom|null>(null),[rooms,setRooms]=useState<RoomListEntry[]>([]),[connected,setConnected]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(false);
 const [messages,setMessages]=useState<(ChatMessage&{receivedAt?:number})[]>([]),[chatError,setChatError]=useState(''),[chatPending,setChatPending]=useState(false);
 const currentRoom=useRef<string|undefined>(undefined);
 function receiveRoom(r:PublicRoom){currentRoom.current=r.code;setRoom(r);setMessages(previous=>(r.chat||[]).map(message=>({...message,receivedAt:previous.find(m=>m.id===message.id)?.receivedAt})));}
 const socket=useRef<Socket|null>(null);const [recoveryCode,setRecoveryCode]=useState('');
 function clear(){try{for(const storage of [localStorage,sessionStorage]){storage.removeItem('yutverse.token');storage.removeItem('yutverse.account')}}catch{}setRecoveryCode('');setToken('');setUser(null);setRoom(null);currentRoom.current=undefined;setMessages([]);setRooms([]);setError('');}
 function accept(data:{token:string;user:AccountUser;recoveryCode?:string},remember=true){try{for(const storage of [localStorage,sessionStorage]){storage.removeItem('yutverse.token');storage.removeItem('yutverse.account')}const storage=remember?localStorage:sessionStorage;storage.setItem('yutverse.token',data.token);storage.setItem('yutverse.account',JSON.stringify(data.user))}catch{setError('로그인 정보를 저장할 수 없습니다. 새로고침하면 다시 로그인해야 합니다.')}setUser(data.user);setToken(data.token);setRecoveryCode(data.recoveryCode||'');setChecking(false);}

 useEffect(()=>{
  if(!token){setChecking(false);return;}const controller=new AbortController();setChecking(true);
  void fetch('/api/auth/me',{headers:{Authorization:`Bearer ${token}`},signal:controller.signal}).then(async response=>{if(response.status===401){clear();return;}if(!response.ok)throw Error();const data=await response.json();setUser(data.user);try{(sessionStorage.getItem('yutverse.token')===token?sessionStorage:localStorage).setItem('yutverse.account',JSON.stringify(data.user))}catch{}}).catch(e=>{if(e.name!=='AbortError')setError('계정 서버에 연결할 수 없습니다. 싱글플레이는 계속할 수 있습니다.')}).finally(()=>{if(!controller.signal.aborted)setChecking(false)});
  return()=>controller.abort();
 },[token]);
 useEffect(()=>{
  if(!enabled||!token)return;
  const client=io({auth:{token},reconnection:true});socket.current=client;
  client.on('connect',()=>{setConnected(true);setError('');client.emit('sync',{},(r:Reply)=>{if(r.ok&&r.room)receiveRoom(r.room)});});
  client.on('rooms',(list:RoomListEntry[])=>setRooms(list));client.on('room',(r:PublicRoom)=>receiveRoom(r));client.on('left',()=>{currentRoom.current=undefined;setRoom(null);setMessages([]);setChatError('')});
  client.on('chat',(event:{code:string;message:ChatMessage})=>{if(event.code===currentRoom.current)setMessages(previous=>[...previous.filter(m=>m.id!==event.message.id),{...event.message,receivedAt:Date.now()}].slice(-CHAT_LIMIT))});
  client.on('disconnect',(reason:string)=>{setConnected(false);if(reason==='io server disconnect')void fetch('/api/auth/me',{headers:{Authorization:`Bearer ${token}`}}).then(r=>{if(r.status===401)clear()}).catch(()=>{});});client.on('connect_error',(e:Error)=>setError(e.message));
  return()=>{client.disconnect();socket.current=null;setConnected(false)};
 },[enabled,token]);
 async function authenticate(kind:'login'|'register',data:{login:string;password:string;nickname?:string;remember?:boolean}){
  setPending(true);setError('');try{const response=await fetch(`/api/auth/${kind}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Error(result.error||'로그인에 실패했습니다.');accept(result,data.remember!==false);return true;}catch(e){setError(e instanceof Error?e.message:'계정 서버에 연결할 수 없습니다.');return false}finally{setPending(false)}
 }
 async function request(event:string,data:object={}){
  if(!socket.current?.connected){setError('서버와 연결되지 않았습니다.');return false;}
  setPending(true);setError('');try{const reply=await socket.current.timeout(5000).emitWithAck(event,data) as Reply;if(!reply.ok)throw Error(reply.error);if(reply.room)receiveRoom(reply.room);if(reply.rooms)setRooms(reply.rooms);return true;}catch(e){if(e instanceof Error&&e.message==='다시 로그인하세요.')clear();else setError(e instanceof Error?e.message:'요청 실패');return false}finally{setPending(false)}
 }
 async function sendChat(data:{kind:'text';text:string}|{kind:'reaction';reactionId:string}){
  if(!socket.current?.connected||!currentRoom.current){setChatError('서버에 연결한 뒤 다시 보내세요.');return false;}
  const code=currentRoom.current;setChatPending(true);setChatError('');
  try{const reply=await socket.current.timeout(5000).emitWithAck('chat',data) as Reply;if(!reply.ok)throw Error(reply.error);return true;}
  catch(e){if(currentRoom.current===code)setChatError(e instanceof Error?e.message:'채팅 전송 실패');return false;}
  finally{setChatPending(false);}
 }
 async function logout(){setPending(true);setError('');try{const response=await fetch('/api/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`}});if(!response.ok&&response.status!==401){const data=await response.json();throw Error(data.error)}socket.current?.disconnect();clear();return true;}catch(e){setError(e instanceof Error?e.message:'로그아웃에 실패했습니다.');return false}finally{setPending(false)}}
 return {messages,chatError,chatPending,sendChat,recoveryCode,setRecoveryCode,dismissRecovery:()=>setRecoveryCode(''),room,rooms,connected,error,pending,token,user,checking,authenticate,logout,request,resetSession:clear,act:(kind:string,data:object={})=>request('act',{kind,revision:room?.revision,...data})};
}
