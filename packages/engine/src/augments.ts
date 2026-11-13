export type AugmentId = 'do-plus'|'gae-plus'|'geol-plus'|'launch'|'late'|'stack'|'hunter'|'shield'|'return'|'finish'|'reroll'|'boost'|'leap'|'forward'|'steady'|'reserve'|'hero-wind'|'hero-guard'|'hero-phoenix'|'hero-finish';
export type Augment = {id:AugmentId;name:string;description:string;hero:boolean;manual:boolean;charges:number;conflicts?:AugmentId[]};
export type Slot = {id:AugmentId;remaining:number;usedTurn?:number};
export const AUGMENTS:Augment[] = [
 {id:'do-plus',name:'작은 발걸음',description:'도가 나오면 이동 +1.',hero:false,manual:false,charges:-1},
 {id:'gae-plus',name:'두 걸음의 여유',description:'개가 나오면 이동 +1.',hero:false,manual:false,charges:-1},
 {id:'geol-plus',name:'걸음의 리듬',description:'걸이 나오면 이동 +1.',hero:false,manual:false,charges:-1},
 {id:'launch',name:'힘찬 출발',description:'대기 중인 말을 출발시키면 이동 +1.',hero:false,manual:false,charges:-1},
 {id:'late',name:'마지막 질주',description:'외곽 16~19번에서 출발하면 이동 +1.',hero:false,manual:false,charges:-1},
 {id:'stack',name:'함께 달리기',description:'업은 말을 이동하면 이동 +1.',hero:false,manual:false,charges:-1},
 {id:'hunter',name:'추격자',description:'잡기에 성공하면 추가 던지기 +1. 기본 턴당 1회.',hero:false,manual:false,charges:-1},
 {id:'shield',name:'달빛 방패',description:'잡기 1회를 막습니다. 한 칸에 상대와 함께 머물 수 있습니다.',hero:false,manual:false,charges:1,conflicts:['hero-guard']},
 {id:'return',name:'다시 출발',description:'잡히면 대기 대신 1번 칸으로 복귀. 경기당 1회.',hero:false,manual:false,charges:1,conflicts:['hero-phoenix']},
 {id:'finish',name:'완주의 선물',description:'말을 완주시킬 때 추가 던지기 +1. 경기당 1회.',hero:false,manual:false,charges:1},
 {id:'reroll',name:'다시 한 번',description:'현재 윷 결과를 공정한 확률로 다시 던집니다. 경기당 1회.',hero:false,manual:true,charges:1},
 {id:'boost',name:'바람 한 줌',description:'현재 양수 이동 결과에 +1. 경기당 1회.',hero:false,manual:true,charges:1},
 {id:'leap',name:'도약',description:'현재 양수 이동 결과에 +2. 경기당 1회.',hero:false,manual:true,charges:1},
 {id:'forward',name:'뒤집힌 운명',description:'현재 빽도를 앞으로 한 칸으로 변경. 경기당 1회.',hero:false,manual:true,charges:1},
 {id:'steady',name:'안정된 걸음',description:'현재 양수 결과를 두 칸으로 변경. 경기당 1회.',hero:false,manual:true,charges:1},
 {id:'reserve',name:'비장의 한 수',description:'던지기 대기 중 추가 던지기 +1. 경기당 1회.',hero:false,manual:true,charges:1},
 {id:'hero-wind',name:'바람의 주인',description:'모든 양수 이동 +1. 영웅 증강.',hero:true,manual:false,charges:-1},
 {id:'hero-guard',name:'수호자의 맹세',description:'잡기 2회를 막습니다. 영웅 증강.',hero:true,manual:false,charges:2,conflicts:['shield']},
 {id:'hero-phoenix',name:'불사조',description:'잡히면 5번 칸으로 복귀. 경기당 1회. 영웅 증강.',hero:true,manual:false,charges:1,conflicts:['return']},
 {id:'hero-finish',name:'끝없는 여정',description:'완주 시 추가 던지기 +1. 기본 턴당 1회. 영웅 증강.',hero:true,manual:false,charges:-1},
];
export function definition(id:string):Augment|undefined{return AUGMENTS.find(a=>a.id===id);}
export function available(slots:Slot[],id:AugmentId){return slots.find(a=>a.id===id&&a.remaining!==0);}
export function eligible(slots:Slot[],a:Augment){return slots.length<5&&!slots.some(s=>s.id===a.id||a.conflicts?.includes(s.id)||definition(s.id)?.conflicts?.includes(a.id))&&(!a.hero||!slots.some(s=>definition(s.id)?.hero));}
export function candidates(slots:Slot[],random:()=>number):AugmentId[]{
 const pool=AUGMENTS.filter(a=>eligible(slots,a));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,3).map(a=>a.id);
}
