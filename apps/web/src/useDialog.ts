import {useEffect,useRef} from 'react';
export function useDialog(onClose:()=>void,escape=true){
 const ref=useRef<HTMLElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const node=ref.current,previous=document.activeElement as HTMLElement|null;if(!node)return;const controls=()=>[...node.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')];const frame=requestAnimationFrame(()=>controls()[0]?.focus());
  const handle=(event:KeyboardEvent)=>{if(event.key==='Escape'&&escape){event.preventDefault();close.current();return;}if(event.key!=='Tab')return;const list=controls(),first=list[0],last=list.at(-1);if(!first){event.preventDefault();return;}if(!node.contains(document.activeElement)||(event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last)){event.preventDefault();(event.shiftKey?last:first)?.focus();}};
  node.addEventListener('keydown',handle);return()=>{cancelAnimationFrame(frame);node.removeEventListener('keydown',handle);if(previous?.isConnected)previous.focus()};
 },[escape]);return ref;
}
