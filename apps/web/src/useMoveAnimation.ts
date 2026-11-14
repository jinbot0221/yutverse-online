import {useLayoutEffect,useEffect,useRef,useState} from 'react';
import type {State} from '@yutverse/engine';
import {createAnimation,type AnimationPlan} from './motion';
export function useMoveAnimation(state:State|undefined){
 const previous=useRef(state),[animation,setAnimation]=useState<AnimationPlan|null>(null);
 useLayoutEffect(()=>{
  const before=previous.current;previous.current=state;
  if(!state||state.phase==='augment'||before?.players.length!==state.players.length){setAnimation(null);return;}
  if(state.lastMove?.id!==before?.lastMove?.id){
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   setAnimation(createAnimation(before,state,performance.now(),reduced));
  }
 },[state]);
 useEffect(()=>{if(!animation)return;const timer=setTimeout(()=>setAnimation(current=>current===animation?null:current),Math.max(0,animation.duration-(performance.now()-animation.start)));return()=>clearTimeout(timer)},[animation]);
 return animation;
}
