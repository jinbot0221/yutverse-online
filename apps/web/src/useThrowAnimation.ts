import {useLayoutEffect,useEffect,useRef,useState,useCallback} from 'react';
import type {State} from '@yutverse/engine';
import {createThrowAnimation,type ThrowAnimation} from './throw-motion';
export function useThrowAnimation(state:State|undefined){
 const previous=useRef(state),[animation,setAnimation]=useState<ThrowAnimation|null>(null);
 useLayoutEffect(()=>{const before=previous.current;previous.current=state;if(!state||before?.players.length!==state.players.length){setAnimation(null);return;}if(state.lastThrow?.id!==before?.lastThrow?.id)setAnimation(createThrowAnimation(before,state,Number.POSITIVE_INFINITY,window.matchMedia('(prefers-reduced-motion: reduce)').matches));},[state]);
 const finish=useCallback((completed:ThrowAnimation)=>setAnimation(current=>current===completed?null:current),[]);
 // Normal completion comes from rendered frames. The timeout only releases a
 // hidden/failed canvas; shader compilation must not consume the animation.
 useEffect(()=>{if(!animation)return;const timer=setTimeout(()=>finish(animation),animation.duration+30000);return()=>clearTimeout(timer)},[animation,finish]);
 return {animation,finish};
}
