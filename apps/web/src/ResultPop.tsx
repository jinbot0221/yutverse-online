import {useEffect,useRef,useState} from 'react';
import type {ThrowAnimation} from './throw-motion';
export function ResultPop({animation}:{animation:ThrowAnimation|null}){
 const previous=useRef(animation),[event,setEvent]=useState<ThrowAnimation['event']|null>(null);
 useEffect(()=>{const ended=previous.current;previous.current=animation;if(ended&&!animation)setEvent(ended.event)},[animation]);
 useEffect(()=>{if(!event)return;const timer=setTimeout(()=>setEvent(null),1400);return()=>clearTimeout(timer)},[event]);
 if(!event)return null;const special=event.result.extra||event.guarded;
 return <div key={event.id} className={`result-pop ${special?'special':''}`} role="status" aria-label="윷 결과 이펙트"><div className="pop-rays"/><div className="pop-ring"/><strong>{event.guarded?'빽도 까방!':`${event.result.name}!`}</strong><span>{event.guarded?'까방권 사용 · 다시 던지세요':event.result.extra?'한 번 더 던지세요!':event.result.steps<0?'뒤로 한 칸':`앞으로 ${event.result.steps}칸`}</span>{Array.from({length:8},(_,i)=><i key={i} style={{'--ray':i} as React.CSSProperties}/> )}</div>;
}
