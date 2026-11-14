import {useLayoutEffect,useEffect,useRef,useState,useCallback} from 'react';
import type {State} from '@yutverse/engine';
import {createAnimation,type AnimationPlan} from './motion';
export function useMoveAnimation(state:State|undefined){
 const previous=useRef(state),[animation,setAnimation]=useState<AnimationPlan|null>(null);
 useLayoutEffect(()=>{
  const before=previous.current;previous.current=state;
  if(!state||before?.players.length!==state.players.length){setAnimation(null);return;}
  if(state.lastMove?.id!==before?.lastMove?.id){
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   setAnimation(createAnimation(before,state,Number.POSITIVE_INFINITY,reduced));
  }
 },[state]);
 const finish=useCallback((completed:AnimationPlan)=>setAnimation(current=>current===completed?null:current),[]);
 // Normal completion comes from rendered frames. The timeout only releases a
 // hidden/failed canvas; shader compilation must not consume the animation.
 useEffect(()=>{if(!animation)return;const timer=setTimeout(()=>finish(animation),animation.duration+30000);return()=>clearTimeout(timer)},[animation,finish]);
 return {animation,finish};
}
