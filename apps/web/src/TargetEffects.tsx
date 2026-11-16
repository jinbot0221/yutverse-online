import {currentTargetEffects,targetEffectHistory,definition,type State,type TargetEffectView} from '@yutverse/engine';
export function TargetEffects({state,player,me}:{state:State;player:number;me:number}){
 const involved=(e:TargetEffectView)=>e.owner===player||e.target===player;
 const effects=currentTargetEffects(state).filter(involved),history=targetEffectHistory(state).filter(involved);
 const name=(i:number)=>`${state.players[i]?.name||'알 수 없음'}${i===me?' (나)':''}`;
 const row=(e:TargetEffectView)=><li className="target-effect-row" key={`${e.serial}:${e.owner}:${e.target}`}><strong className="effect-direction"><span>{name(e.owner)}</span><span aria-label="대상">→</span><span>{name(e.target)}</span></strong><b>{definition(e.id)?.name||'특성 효과'}</b><p>{e.detail}</p><small>{e.round>0?`${e.round}라운드 · `:''}{e.status}</small></li>;
 return <section className="target-effects" aria-label="특성 관계"><h3>누가 누구에게 걸었나요?</h3><p>선택한 플레이어가 건 효과와 받은 효과입니다. 화살표는 사용자 → 대상입니다.</p><h4>현재 적용 중</h4>{effects.length?<ul aria-label="현재 특성 효과">{effects.map(row)}</ul>:<p>현재 표시할 대상 지정 효과가 없습니다.</p>}<details><summary>이전 사용 기록 ({history.length})</summary>{history.length?<ul aria-label="특성 사용 기록">{history.map(row)}</ul>:<p>아직 기록이 없습니다. 이전 버전에서 사용한 특성은 사용 기록이 없을 수 있습니다.</p>}</details></section>;
}
