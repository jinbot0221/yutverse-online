import {getAugmentHelp} from './augment-help.ts';
export {AUGMENT_HELP,getAugmentHelp,type AugmentHelp} from './augment-help.ts';
import {REQUESTED_AUGMENTS} from './requested-augments.ts';
export {REQUESTED_AUGMENTS} from './requested-augments.ts';
export type GameStyle = 'normal'|'augment';
export type AugmentId = `custom-${string}`|'back-guard'|'do-plus'|'gae-plus'|'geol-plus'|'launch'|'late'|'stack'|'hunter'|'shield'|'return'|'finish'|'reroll'|'boost'|'leap'|'forward'|'steady'|'reserve'|'hero-wind'|'hero-guard'|'hero-phoenix'|'hero-finish'|'double-reserve'|'first-boost'|'steady-pocket'|'hero-pouch'|'do-echo'|'mo-echo';
export type Augment = {id:AugmentId;name:string;description:string;hero:boolean;manual:boolean;charges:number;conflicts?:AugmentId[]};
export type Slot = {id:AugmentId;remaining:number;usedTurn?:number;original?:AugmentId;restoreRound?:number};
export const ACTIVE_AUGMENT_IDS:AugmentId[]=['shield','boost','back-guard'];
export const AUGMENTS:Augment[] = [
 ...REQUESTED_AUGMENTS.map(a=>({...a,id:a.id as AugmentId,hero:false})),
 {id:'back-guard',name:'빽도 까방권',description:getAugmentHelp('back-guard')!.effect,hero:false,manual:false,charges:1},
 {id:'do-plus',name:'작은 발걸음',description:'도가 나오면 이동 +1.',hero:false,manual:false,charges:-1},
 {id:'gae-plus',name:'두 걸음의 여유',description:'개가 나오면 이동 +1.',hero:false,manual:false,charges:-1},
 {id:'geol-plus',name:'걸음의 리듬',description:'걸이 나오면 이동 +1.',hero:false,manual:false,charges:-1},
 {id:'launch',name:'힘찬 출발',description:'대기 중인 말을 출발시키면 1칸 더 갑니다.',hero:false,manual:false,charges:-1},
 {id:'late',name:'마지막 질주',description:'마지막 모서리를 지난 뒤 바깥길에서 출발하면 1칸 더 갑니다.',hero:false,manual:false,charges:-1},
 {id:'stack',name:'함께 달리기',description:'함께 업힌 말을 움직이면 1칸 더 갑니다.',hero:false,manual:false,charges:-1},
 {id:'hunter',name:'추격자',description:'잡기에 성공하면 추가 던지기 +1. 내 차례마다 1회.',hero:false,manual:false,charges:-1},
 {id:'shield',name:'잡기 1회 까방권',description:getAugmentHelp('shield')!.effect,hero:false,manual:false,charges:1,conflicts:['hero-guard']},
 {id:'return',name:'다시 출발',description:'잡히면 대기칸 대신 출발 후 첫 칸으로 돌아갑니다. 경기당 1회.',hero:false,manual:false,charges:1,conflicts:['hero-phoenix']},
 {id:'finish',name:'완주의 선물',description:'말을 완주시킬 때 추가 던지기 +1. 경기당 1회.',hero:false,manual:false,charges:1},
 {id:'reroll',name:'다시 한 번',description:'골라 둔 결과를 다시 던집니다. 이미 받은 추가 기회는 유지합니다. 경기당 1회.',hero:false,manual:true,charges:1},
 {id:'boost',name:'1칸 더 가기',description:getAugmentHelp('boost')!.effect,hero:false,manual:true,charges:1},
 {id:'leap',name:'도약',description:'앞으로 가는 도·개·걸·윷·모의 이동 거리를 2칸 늘립니다. 경기당 1회.',hero:false,manual:true,charges:1},
 {id:'forward',name:'뒤집힌 운명',description:'현재 빽도를 앞으로 한 칸으로 변경. 경기당 1회.',hero:false,manual:true,charges:1},
 {id:'steady',name:'안정된 걸음',description:'도·개·걸·윷·모 중 골라 둔 결과를 앞으로 2칸으로 바꿉니다. 경기당 1회.',hero:false,manual:true,charges:1},
 {id:'reserve',name:'비장의 한 수',description:'던지기 대기 중 추가 던지기 +1. 경기당 1회.',hero:false,manual:true,charges:1},
 {id:'hero-wind',name:'바람의 주인',description:'도·개·걸·윷·모로 앞으로 갈 때 1칸 더 갑니다. 영웅 증강.',hero:true,manual:false,charges:-1},
 {id:'hero-guard',name:'수호자의 맹세',description:'잡기 2회를 막습니다. 영웅 증강.',hero:true,manual:false,charges:2,conflicts:['shield']},
 {id:'hero-phoenix',name:'불사조',description:'잡히면 첫 번째 갈림길로 돌아갑니다. 경기당 1회. 영웅 증강.',hero:true,manual:false,charges:1,conflicts:['return']},
 {id:'hero-finish',name:'끝없는 여정',description:'완주 시 추가 던지기 +1. 내 차례마다 1회. 영웅 증강.',hero:true,manual:false,charges:-1},
 {id:'double-reserve',name:'두 번의 여유',description:'윷을 던지기 전에 사용하면 최대 2번 더 던집니다. 경기당 1회, 남은 기회 최대 4번.',hero:false,manual:true,charges:1},
 {id:'first-boost',name:'주머니 속 여분 윷',description:'다음에 윷을 던진 뒤 1번 더 던집니다. 경기당 1회.',hero:false,manual:false,charges:1},
 {id:'steady-pocket',name:'세 번째 차례의 선물',description:'내 3·6·9번째 차례처럼 세 번째 차례마다 1번 더 던집니다.',hero:false,manual:false,charges:-1},
 {id:'hero-pouch',name:'윷 보따리',description:'윷을 던지기 전에 사용하면 최대 3번 더 던집니다. 경기당 1회, 남은 기회 최대 4번.',hero:true,manual:true,charges:1},
 {id:'do-echo',name:'도의 메아리',description:'도가 나오면 1번 더 던집니다. 내 차례마다 1회.',hero:false,manual:false,charges:-1},
 {id:'mo-echo',name:'모의 메아리',description:'모가 나오면 원래 보상에 더해 1번 더 던집니다. 내 차례마다 1회.',hero:false,manual:false,charges:-1},

];
export function definition(id:string):Augment|undefined{return AUGMENTS.find(a=>a.id===id);}
export function available(slots:Slot[],id:AugmentId){return slots.find(a=>a.id===id&&a.remaining!==0);}
export function eligible(slots:Slot[],a:Augment,style:GameStyle='normal'){if(style==='normal'&&ACTIVE_AUGMENT_IDS.includes(a.id))return slots.length<5&&!slots.some(s=>a.conflicts?.includes(s.id)||definition(s.id)?.conflicts?.includes(a.id));return slots.length<(a.id.startsWith('custom-')?10:5)&&!slots.some(s=>s.id===a.id||a.conflicts?.includes(s.id)||definition(s.id)?.conflicts?.includes(a.id))&&(!a.hero||!slots.some(s=>definition(s.id)?.hero));}
export function candidates(slots:Slot[],random:()=>number,style:GameStyle='normal',round=1,excluded:string[]=[]):AugmentId[]{
 const pool=AUGMENTS.filter(a=>(style==='augment'?REQUESTED_AUGMENTS.some(r=>r.id===a.id&&(r.stage==='universal'||(round===1?r.stage==='start':r.stage==='late'))):ACTIVE_AUGMENT_IDS.includes(a.id))&&!excluded.includes(a.id)&&eligible(slots,a,style));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,3).map(a=>a.id);
}
