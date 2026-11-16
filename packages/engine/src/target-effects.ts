import type {State} from './index.ts';
export type TargetEffect={serial:number;id:string;owner:number;target:number;round:number;turn:number;detail:string;untilRound?:number;untilBaseTurn?:number;kind?:'link'|'duel'|'freeze'|'illusion';piece?:number;slot?:number};
export type TargetEffectView=TargetEffect&{status:string;active:boolean};
export function recordTargetEffect(s:State,owner:number,target:number,id:string,detail:string,extra:Partial<TargetEffect>={}){
 if(!s.players[owner]||!s.players[target])return;
 const sp=s.special??={},serial=(sp.targetSerial||0)+1;sp.targetSerial=serial;
 const event:TargetEffect={...extra,serial,id,owner,target,round:s.round||1,turn:s.turns,detail};
 sp.targetHistory=[...(sp.targetHistory||[]),event].slice(-60);
 s.log=[`${s.players[owner].name} → ${s.players[target].name}: ${detail}`,...s.log].slice(0,12);
}
export function targetEffectHistory(s:State):TargetEffectView[]{return [...s.special?.targetHistory||[]].reverse().map(e=>{
 let active=false,status='적용 기록';
 if(e.untilRound!==undefined){active=(s.round||1)<e.untilRound;status=active?`${e.untilRound-(s.round||1)}라운드 남음`:'효과 종료';}
 if(e.untilBaseTurn!==undefined){active=s.players[e.target].baseTurns<e.untilBaseTurn;status=active?`다음 기본 차례 ${e.untilBaseTurn-s.players[e.target].baseTurns}회까지`:'효과 종료';}
 if(e.kind==='link'){active=s.special?.linked?.[e.owner]===e.target&&!(s.special?.targetHistory||[]).some(newer=>newer.kind==='link'&&newer.owner===e.owner&&newer.serial>e.serial);status=active?(e.id==='custom-necromancer'?'승리 연결 중':'승패 연결 중'):'연결 종료';}
 if(e.kind==='duel'){const d=s.special?.duels?.find(d=>d.owner===e.owner&&d.target===e.target&&d.end===e.untilBaseTurn);active=Boolean(d);status=active?`대상 기본 차례 ${Math.max(0,d!.end-s.players[e.target].baseTurns)}회 내 완주 판정`:'승부 종료';}
 if(e.kind==='freeze'){active=active&&s.players[e.target].pieces.some(p=>p.frozenUntil===e.untilRound&&(p.frozenBy===undefined||p.frozenBy===e.owner)&&p.node!=='done'&&p.node!=='home');status=active?`${e.untilRound!-(s.round||1)}라운드 동안 이동 금지`:'효과 종료';}
 if(e.kind==='illusion'){const slot=s.players[e.target].slots[e.slot!];active=active&&Boolean(slot?.original&&slot.restoreRound===e.untilRound&&(slot.modifiedBy===undefined||slot.modifiedBy===e.owner));status=active?`${e.untilRound!-(s.round||1)}라운드 동안 특성 무효`:'효과 종료';}
 if(s.phase==='over'||s.ranks.includes(e.target)||s.forfeited.includes(e.target)||(e.kind==='link'&&(s.ranks.includes(e.owner)||s.forfeited.includes(e.owner)))){active=false;if(status!=='적용 기록')status='효과 종료';}
 return {...e,active,status};
});}
export function currentTargetEffects(s:State):TargetEffectView[]{
 const result=targetEffectHistory(s).filter(e=>e.active);
 // Relationships already in saved games can be shown without inventing a source.
 for(const [from,to] of Object.entries(s.special?.linked||{})){const owner=Number(from);if(!result.some(e=>e.kind==='link'&&e.owner===owner&&e.target===to)&&s.phase!=='over'&&!s.ranks.includes(owner)&&!s.forfeited.includes(owner)&&!s.ranks.includes(to)&&!s.forfeited.includes(to))result.push({serial:-(owner+1),id:s.special?.linkedOnly?.includes(owner)?'custom-leech':'custom-necromancer',owner,target:to,round:0,turn:0,detail:s.special?.linkedOnly?.includes(owner)?'승패 연결':'승리 연결',kind:'link',status:s.special?.linkedOnly?.includes(owner)?'승패 연결 중':'승리 연결 중',active:true});}
 if(s.special?.fogUntil&&s.turns<s.special.fogUntil&&s.special.fogOwner!==undefined&&s.phase!=='over')for(let target=0;target<s.players.length;target++)if(target!==s.special.fogOwner&&!s.ranks.includes(target)&&!s.forfeited.includes(target))result.push({serial:-2000-target,id:'custom-fog',owner:s.special.fogOwner,target,round:0,turn:0,detail:'안개 · 자기 말 주변만 보임',status:`기본 차례 ${s.special.fogUntil-s.turns}회 뒤 해제`,active:true});
 s.players.forEach((p,target)=>{if(s.phase==='over'||s.ranks.includes(target)||s.forfeited.includes(target))return;
  const hosts=new Set<number>();p.pieces.forEach(t=>{if(t.riding)hosts.add(Number(t.riding.split(':')[0]));});
  for(const host of hosts)if(s.players[host])result.push({serial:-100-target*10-host,id:'custom-hitchhike',owner:target,target:host,round:0,turn:0,detail:'상대 말에 무임승차',status:'상대 이동·완주를 따라가는 중',active:true});
  p.pieces.forEach((t,index)=>{if(t.bomb)result.push({serial:-1000-target*100-index,id:'custom-bomb',owner:t.bomb.owner,target,round:0,turn:0,detail:`말 ${index+1}에 폭탄`,status:`${t.bomb.round}라운드에 폭발`,active:true});});
 });return result;
}
