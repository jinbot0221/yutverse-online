import {useEffect,useRef,useState} from 'react';
import {io,type Socket} from 'socket.io-client';
import type {State} from '@yutverse/engine';
export type PublicRoom={code:string;capacity:2|3|4;owner:string;members:{id:string;name:string;ready:boolean;connected:boolean}[];state:State|null;revision:number;me:number;actionDeadline:number|null};
type Reply={ok:boolean;error?:string;room?:PublicRoom};
function savedToken(){try{return localStorage.getItem('yutverse.token')||''}catch{return ''}}
export function useOnline(enabled:boolean){
 const [token,setToken]=useState(savedToken),[room,setRoom]=useState<PublicRoom|null>(null),[connected,setConnected]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(false);
 const socket=useRef<Socket|null>(null);
 useEffect(()=>{
  if(!enabled||!token)return;
  const client=io({auth:{token},reconnection:true});socket.current=client;
  client.on('connect',()=>{setConnected(true);setError('');client.emit('sync',{},(r:Reply)=>{if(r.ok&&r.room)setRoom(r.room)});});
  client.on('room',(r:PublicRoom)=>setRoom(r));client.on('left',()=>setRoom(null));
  client.on('disconnect',()=>setConnected(false));client.on('connect_error',(e:Error)=>setError(e.message));
  return()=>{client.disconnect();socket.current=null;setConnected(false)};
 },[enabled,token]);
 async function login(name:string){setPending(true);setError('');try{const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});const data=await response.json();if(!response.ok)throw Error(data.error||'세션 생성 실패');try{localStorage.setItem('yutverse.token',data.token)}catch{setError('세션 저장 실패: 새로고침 후 복구할 수 없습니다.')}setToken(data.token);}catch(e){setError(e instanceof Error?e.message:'서버 연결 실패')}finally{setPending(false)}}
 async function request(event:string,data:object={}){
  if(!socket.current?.connected){setError('서버와 연결되지 않았습니다.');return;}
  setPending(true);setError('');try{const reply=await socket.current.timeout(5000).emitWithAck(event,data) as Reply;if(!reply.ok)throw Error(reply.error);if(reply.room)setRoom(reply.room);}catch(e){setError(e instanceof Error?e.message:'요청 실패')}finally{setPending(false)}
 }
 function resetSession(){try{localStorage.removeItem('yutverse.token')}catch{}setToken('');setRoom(null);setError('');}
 return {room,connected,error,pending,token,login,request,resetSession,act:(kind:string,data:object={})=>request('act',{kind,revision:room?.revision,...data})};
}
