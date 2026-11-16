import type {GameStyle} from '@yutverse/engine';
export function GameStylePicker({value,onChange,label='게임 방식'}:{value:GameStyle;onChange:(style:GameStyle)=>void;label?:string}){
 return <div className="game-style-picker"><label>{label}<select aria-label={label} value={value} onChange={e=>onChange(e.target.value as GameStyle)}><option value="normal">일반 모드</option><option value="augment">증강 모드</option></select></label><p>{value==='normal'?'지금까지의 규칙 그대로 · 잡기 까방 / 1칸 더 / 빽도 까방 · 같은 카드를 다시 고르면 사용 횟수 +1':'27종 증강 중 무작위 3개에서 선택 · 최대 5개 획득 · 영웅은 최대 1개 · 같은 증강 중복 획득 없음'}</p></div>;
}
