import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CHAT_REACTIONS,type ChatMessage} from '@yutverse/engine';
import {useDialog} from './useDialog';
function ChatDialog({messages,muted,onMute,onClose,send,pending,error,connected,me}:{messages:ChatMessage[];muted:boolean;onMute:()=>void;onClose:()=>void;send:(data:{kind:'text';text:string}|{kind:'reaction';reactionId:string})=>Promise<boolean>;pending:boolean;error:string;connected:boolean;me:string}){
 const ref=useDialog(onClose),end=useRef<HTMLDivElement>(null),[text,setText]=useState('');
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'})},[messages.length,muted]);
 return createPortal(<div className="chat-backdrop" onClick={onClose}><section ref={ref} className="room-chat-dialog" role="dialog" aria-modal="true" aria-label="방 채팅" onClick={e=>e.stopPropagation()}><div className="chat-heading"><h2>방 채팅</h2><button type="button" onClick={onClose}>채팅 닫기</button></div><div className="chat-toolbar"><span>{connected?'같은 방 참가자끼리만 대화합니다.':'재연결 중 · 전송 대기'}</span><button type="button" aria-pressed={muted} onClick={onMute}>{muted?'채팅 표시':'채팅 숨기기'}</button></div><div className="chat-history" role="log" aria-label="채팅 내역" aria-live={muted?'off':'polite'} aria-relevant="additions text">{muted?<p>채팅과 말풍선을 숨겼습니다.</p>:messages.length?messages.map(m=><article key={m.id} className={m.senderId===me?'chat-message mine':'chat-message'}><div><strong>{m.name}{m.senderId===me?' (나)':''}</strong><time dateTime={new Date(m.at).toISOString()}>{new Date(m.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.text}</p></article>):<p>첫 인사를 보내보세요! 최근 50개를 보여줍니다.</p>}<div ref={end}/></div><div className="chat-reactions" role="group" aria-label="빠른 이모티콘">{CHAT_REACTIONS.map(r=><button key={r.id} type="button" title={r.label} aria-label={`${r.emoji} ${r.label}`} disabled={!connected||pending} onClick={()=>void send({kind:'reaction',reactionId:r.id})}><span>{r.emoji}</span><small>{r.label}</small></button>)}</div><form className="chat-compose" onSubmit={async e=>{e.preventDefault();if(text.trim()&&await send({kind:'text',text}))setText('')}}><label className="chat-input">메시지<input aria-label="채팅 메시지" placeholder="한마디 보내기 (160자)" value={text} onChange={e=>setText(e.target.value)} maxLength={160} autoComplete="off"/></label><button disabled={!connected||pending||!text.trim()}>보내기</button></form>{error&&<p role="alert" className="chat-error">{error}</p>}<small className="chat-footnote">10초에 최대 5번 · 숨기면 말풍선도 표시하지 않습니다.</small></section></div>,document.body);
}
export function RoomChat({roomCode,messages,muted,onMute,blocked,...props}:{roomCode:string;messages:ChatMessage[];muted:boolean;onMute:()=>void;blocked:boolean;send:(data:{kind:'text';text:string}|{kind:'reaction';reactionId:string})=>Promise<boolean>;pending:boolean;error:string;connected:boolean;me:string}){
 const [open,setOpen]=useState(false),[seen,setSeen]=useState('');
 useEffect(()=>{setOpen(false);setSeen('')},[roomCode]);
 useEffect(()=>{if(blocked)setOpen(false)},[blocked]);
 useEffect(()=>{if(open)setSeen(messages.at(-1)?.id||'')},[open,messages]);
 const unread=!muted&&messages.length>0&&messages.at(-1)?.id!==seen;
 return <><button type="button" className="chat-toggle" disabled={blocked} aria-haspopup="dialog" aria-expanded={open&&!blocked} onClick={()=>setOpen(true)}>💬 채팅{unread?' · 새 메시지':''}</button>{open&&!blocked&&<ChatDialog {...props} messages={messages} muted={muted} onMute={onMute} onClose={()=>setOpen(false)}/>}</>;
}
/** Short-lived reactions only; text chat never covers the board. */
export function useChatReactions(messages:(ChatMessage&{receivedAt?:number})[],muted:boolean){
 const [clock,setClock]=useState(Date.now());
 useEffect(()=>setClock(Date.now()),[messages,muted]);
 useEffect(()=>{if(muted)return;const now=Date.now(),expires=messages.filter(m=>m.kind==='reaction'&&m.receivedAt!==undefined).map(m=>m.receivedAt!+4000).filter(at=>at>now);if(!expires.length)return;const timer=setTimeout(()=>setClock(Date.now()),Math.min(...expires)-now+20);return()=>clearTimeout(timer)},[messages,muted,clock]);
 return muted?[]:messages.filter(m=>m.kind==='reaction'&&m.receivedAt!==undefined&&clock-m.receivedAt>=0&&clock-m.receivedAt<4000);
}
