import {REQUESTED_AUGMENTS,type GameStyle} from '@yutverse/engine';
export function GameStylePicker({value,onChange,label='게임 방식'}:{value:GameStyle;onChange:(style:GameStyle)=>void;label?:string}){
 return <div className="game-style-picker"><label>{label}<select aria-label={label} value={value} onChange={e=>onChange(e.target.value as GameStyle)}><option value="normal">일반 모드</option><option value="augment">증강 모드</option></select></label><p>{value==='normal'?'지금까지의 규칙 그대로 · 잡기 까방 / 1칸 더 / 빽도 까방 · 같은 종류도 새 카드로 재선택 가능 · 1·6·12라운드 선택':`${REQUESTED_AUGMENTS.length}종 증강 · 범용/시작/후반 구분 · 1·6·12라운드 선택 · 중복 획득 없음`}</p></div>;
}
