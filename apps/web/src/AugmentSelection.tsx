import {useEffect,useRef} from 'react';
import {definition,type State} from '@yutverse/engine';
export function AugmentSelection({state,me,remaining,busy,onChoose,onExit,exitPending=false,error}:{state:State;me:number;remaining:number;busy:boolean;onChoose:(id:string)=>void;onExit?:()=>void;exitPending?:boolean;error?:string}){
 const dialog=useRef<HTMLElement>(null),selection=state.selection!;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  const target=dialog.current;const first=target?.querySelector<HTMLButtonElement>('button:not(:disabled)');(first||target)?.focus();
  function trap(event:KeyboardEvent){if(event.key!=='Tab')return;const buttons=[...(target?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[])];if(!buttons.length){event.preventDefault();target?.focus();return;}const first=buttons[0],last=buttons.at(-1)!;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
  target?.addEventListener('keydown',trap);return()=>{target?.removeEventListener('keydown',trap);if(previous?.isConnected)previous.focus()};
 },[selection.player,selection.offers.join(',')]);
 return <section ref={dialog} className="augment-picker" role="dialog" aria-modal="true" aria-label="증강 선택" tabIndex={-1}>
  <div className="augment-intro"><p className="eyebrow">YUTVERSE · AUGMENT</p><div className="selection-clock" role="timer" aria-label="선택 남은 시간">{remaining}<small>초</small></div><h2>{selection.player===me?'이번 여정의 힘을 선택하세요':`${state.players[selection.player].name}의 선택을 기다립니다`}</h2><p>선택 중 전체 게임 정지 · 60초 후 첫 후보 자동 선택</p></div>
  {selection.player===me?<div className="cards">{selection.offers.map(id=>{const a=definition(id)!;return <button key={id} disabled={busy} className={a.hero?'card hero':'card'} onClick={()=>onChoose(id)}><small>{a.hero?'영웅':'일반'} · {a.manual?'수동':'자동'}</small><strong>{a.name}</strong><span>{a.description}</span><em>선택하기 →</em></button>})}</div>:<div className="augment-wait">모든 플레이어가 선택을 마치면 경기가 재개됩니다.</div>}
  {onExit&&<button className="selection-exit" disabled={exitPending} onClick={onExit}>게임 나가기</button>}
  {error&&<p className="error" role="alert">{error}</p>}
 </section>;
}
