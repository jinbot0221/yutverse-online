import {available,candidates,definition,eligible,type Slot,type AugmentId} from './augments.ts';
export * from './augments.ts';
export type Result = { name: string; steps: number; extra: boolean; bonus?:number };
export type Piece = { node: string; history: string[] };
export type Player = { name: string; pieces: Piece[]; slots:Slot[]; baseTurns:number };
export type State = { players: Player[]; turn: number; phase: 'throw'|'move'|'augment'|'over'; result: Result|null; throws: number; ranks: number[]; log: string[]; turns: number; version:2; augmented:boolean; forfeited:number[]; selection:{player:number;offers:AugmentId[];deadline:number;queue:number[]}|null; choices:{player:number;id:AugmentId;turn:number;at:number}[] };
export const HOME = 'home', DONE = 'done';
export function createGame(count: 3|4 = 3, augmented=false, random:()=>number=Math.random, now=Date.now()): State {
 const state:State={version:2,augmented,forfeited:[],selection:null,choices:[],players:Array.from({length:count},(_,i)=>({name:i===0?'나':`AI ${i}`,slots:[],baseTurns:i===0?1:0,pieces:Array.from({length:4},()=>({node:HOME,history:[]}))})),turn:0,phase:'throw',result:null,throws:1,ranks:[],log:['새 경기가 시작되었습니다.'],turns:1};
 return augmented?offer(state,Array.from({length:count},(_,i)=>i),random,now):state;
}
// Four independent fair sticks. One of the four sticks has the back-do mark.
export function roll(random:()=>number=Math.random): Result {
 const sticks=Array.from({length:4},()=>random()<0.5); const n=sticks.filter(Boolean).length;
 if(n===1 && sticks[0]) return {name:'빽도',steps:-1,extra:false};
 return {name:['모','도','개','걸','윷'][n],steps:n===0?5:n,extra:n===0||n===4};
}
const clone = (s:State):State => structuredClone(s);
function nextNode(node:string, shortcut:boolean):string {
 if(node===HOME)return 'o1';
 if(node==='o20')return DONE;
 if(shortcut&&node==='o5')return 'a1';
 if(shortcut&&node==='o10')return 'b1';
 if(node==='a1')return 'a2'; if(node==='a2'||node==='b2')return 'c';
 if(node==='b1')return 'b2'; if(node==='c')return 'd1';
 if(node==='d1')return 'd2'; if(node==='d2')return 'o20';
 if(node==='e1')return 'e2'; if(node==='e2')return 'o15';
 return `o${Number(node.slice(1))+1}`;
}
export function destination(p:Piece,steps:number):Piece|null {
 if(p.node===DONE)return null;
 if(steps<0){if(!p.history.length)return null;const h=[...p.history];return {node:h.pop()!,history:h};}
 let node=p.node;const history=[...p.history];const branch=node==='o5'||node==='o10'||node==='c';
 for(let i=0;i<steps && node!==DONE;i++){
 history.push(node);
 // From the NE corner the diagonal exits SW; from the NW corner it exits SE.
 if(node==='c' && ((i===0&&branch)||history.includes('b1')))node='e1';
 else node=nextNode(node,i===0&&branch);
 }
 return {node,history};
}
export function legalMoves(s:State):number[]{
 if(s.phase!=='move'||!s.result)return [];
 const seen=new Set<string>();return s.players[s.turn].pieces.flatMap((p,i)=>{
 if(!moveDestination(s,i)|| (p.node!==HOME&&seen.has(p.node)))return [];
 seen.add(p.node);return [i];
 });
}
function eliminated(s:State,i:number){return s.ranks.includes(i)||s.forfeited.includes(i);}
function finishMatch(s:State){
 const active=s.players.map((_,i)=>i).filter(i=>!eliminated(s,i));
 if(active.length>1)return false;
 s.ranks=[...s.ranks,...active,...[...s.forfeited].reverse()];s.phase='over';s.selection=null;s.result=null;return true;
}
function offer(s:State,queue:number[],random:()=>number,now:number):State {
 const [player,...rest]=queue;
 if(player===undefined){s.phase='throw';s.selection=null;return s;}
 s.phase='augment';s.selection={player,queue:rest,offers:candidates(s.players[player].slots,random),deadline:now+60000};return s;
}
export function selectAugment(state:State,player:number,id:string,random:()=>number=Math.random,now=Date.now()):State {
 const q=state.selection,def=definition(id);
 if(state.phase!=='augment'||!q||q.player!==player||!def||!q.offers.includes(def.id)||!eligible(state.players[player].slots,def))return state;
 const s=clone(state);s.players[player].slots.push({id:def.id,remaining:def.charges});s.choices.push({player,id:def.id,turn:s.players[player].baseTurns,at:now});
 s.log=[`${s.players[player].name}: ${def.name} 획득`,...s.log].slice(0,12);
 return offer(s,q.queue.filter(i=>!eliminated(s,i)),random,now);
}
export function expireSelection(s:State,now=Date.now(),random:()=>number=Math.random):State {
 if(s.phase!=='augment'||!s.selection||now<s.selection.deadline)return s;
 return selectAugment(s,s.selection.player,s.selection.offers[0],random,now);
}
function advance(s:State,random:()=>number=Math.random,now=Date.now()):State {
 if(finishMatch(s))return s;
 if(s.throws>0&&!eliminated(s,s.turn)){s.phase='throw';return s;}
 do{s.turn=(s.turn+1)%s.players.length;}while(eliminated(s,s.turn));
 s.turns++;s.throws=1;s.phase='throw';const p=s.players[s.turn];p.baseTurns++;
 if(s.augmented&&[2,4,6,8].includes(p.baseTurns)&&p.slots.length<5)return offer(s,[s.turn],random,now);
 return s;
}
export function forfeit(state:State,player:number,random:()=>number=Math.random,now=Date.now()):State {
 if(state.phase==='over'||!state.players[player]||eliminated(state,player))return state;
 const s=clone(state);s.forfeited.push(player);s.log=[`${s.players[player].name} 기권`,...s.log].slice(0,12);
 if(finishMatch(s))return s;
 const pending=s.selection?{...s.selection,queue:s.selection.queue.filter(i=>i!==player)}:null;
 s.selection=null;
 if(s.turn===player){s.throws=0;s.result=null;advance(s,random,now);}
 if(pending){
  if(pending.player===player)return offer(s,pending.queue,random,now);
  s.phase='augment';s.selection=pending;
 }
 return s;
}
export function moveDestination(s:State,index:number):Piece|null {
 const p=s.players[s.turn].pieces[index];if(!p||!s.result)return null;
 let steps=s.result.steps;
 if(steps>0){const slots=s.players[s.turn].slots;let bonus=s.result.bonus||0;
  if(available(slots,'hero-wind'))bonus++;
  if(available(slots,'do-plus')&&s.result.name==='도')bonus++;
  if(available(slots,'gae-plus')&&s.result.name==='개')bonus++;
  if(available(slots,'geol-plus')&&s.result.name==='걸')bonus++;
  if(available(slots,'launch')&&p.node===HOME)bonus++;
  if(available(slots,'late')&&/^o(16|17|18|19)$/.test(p.node))bonus++;
  if(available(slots,'stack')&&p.node!==HOME&&s.players[s.turn].pieces.filter(x=>x.node===p.node).length>1)bonus++;
  steps+=Math.min(2,bonus);
 }return destination(p,steps);
}
export function canUseAugment(s:State,player:number,id:string):boolean {
 const def=definition(id);if(!def||!def.manual||s.turn!==player||eliminated(s,player)||!available(s.players[player].slots,def.id))return false;
 if(id==='reserve')return s.phase==='throw'&&s.throws<4;
 if(s.phase!=='move'||!s.result)return false;
 if(id==='forward')return s.result.steps===-1;
 if(id==='reroll')return true;
 if(id==='boost'||id==='leap')return s.result.steps>0&&(s.result.bonus||0)<2;
 return id==='steady'&&s.result.steps>0&&s.result.steps!==2;
}
export function useAugment(state:State,player:number,id:string,random:()=>number=Math.random,now=Date.now()):State {
 if(!canUseAugment(state,player,id))return state;
 const s=clone(state),slot=s.players[player].slots.find(a=>a.id===id)!;slot.remaining--;
 if(id==='reserve')s.throws++;
 else if(id==='reroll'){if(s.result!.extra)s.throws--;s.result=roll(random);if(s.result.extra)s.throws++;}
 else if(id==='forward')s.result={...s.result!,steps:1,name:'도'};
 else if(id==='steady')s.result={...s.result!,steps:2,name:'고정 개',bonus:0};
 else s.result!.bonus=Math.min(2,(s.result!.bonus||0)+(id==='leap'?2:1));
 s.log=[`${s.players[player].name}: ${definition(id)!.name} 사용`,...s.log].slice(0,12);
 if(s.phase==='move'&&!legalMoves(s).length&&!['forward','reroll'].some(id=>canUseAugment(s,s.turn,id))){s.result=null;return advance(s,random,now);}return s;
}
export function skipMove(state:State,random:()=>number=Math.random,now=Date.now()):State {if(state.phase!=='move'||legalMoves(state).length)return state;const s=clone(state);s.result=null;return advance(s,random,now);}
function trigger(s:State,player:number,id:AugmentId,oncePerTurn=false):boolean {
 const slot=available(s.players[player].slots,id);if(!slot||(oncePerTurn&&slot.usedTurn===s.players[player].baseTurns))return false;
 if(slot.remaining>0)slot.remaining--;slot.usedTurn=s.players[player].baseTurns;return true;
}
export function throwYut(state:State,random:()=>number=Math.random,now=Date.now()):State {
 if(state.phase!=='throw')return state;
 const s=clone(state);s.result=roll(random);s.throws--;if(s.result.extra)s.throws++;
 s.phase='move';s.log=[`${s.players[s.turn].name}: ${s.result.name}`, ...s.log].slice(0,12);
 if(!legalMoves(s).length&&!['forward','reroll'].some(id=>canUseAugment(s,s.turn,id))){s.log.unshift('이동할 말이 없어 차례를 넘깁니다.');s.result=null;return advance(s,random,now);}return s;
}
export function move(state:State,index:number,random:()=>number=Math.random,now=Date.now()):State {
 if(!legalMoves(state).includes(index))return state;
 const s=clone(state), player=s.players[s.turn], original=player.pieces[index], target=moveDestination(s,index)!;
 const group=player.pieces.map((p,i)=>({p,i})).filter(({p,i})=>i===index||(original.node!==HOME&&p.node===original.node));
 for(const {i} of group)player.pieces[i]=structuredClone(target);
 let captured=false;
 if(target.node!==HOME&&target.node!==DONE)s.players.forEach((op,i)=>{
  if(i===s.turn||eliminated(s,i)||!op.pieces.some(p=>p.node===target.node))return;
  if(trigger(s,i,'shield')||trigger(s,i,'hero-guard')){s.log.unshift(`${op.name}: 방패 발동`);return;}
  const respawn=trigger(s,i,'hero-phoenix')?'o5':trigger(s,i,'return')?'o1':HOME;
  op.pieces=op.pieces.map(p=>p.node===target.node?{node:respawn,history:respawn===HOME?[]:[HOME]}:p);captured=true;
 });
 if(captured){s.throws++;if(s.throws<4&&trigger(s,s.turn,'hunter',true))s.throws++;s.log.unshift('잡기! 한 번 더 던집니다.');}
 if(target.node===DONE){if(s.throws<4&&trigger(s,s.turn,'finish'))s.throws++;if(s.throws<4&&trigger(s,s.turn,'hero-finish',true))s.throws++;}
 if(player.pieces.every(p=>p.node===DONE)){s.ranks.push(s.turn);s.throws=0;s.log.unshift(`${player.name} ${s.ranks.length}위 완주!`);}
 s.result=null;return advance(s,random,now);
}
export { chooseMove, type Difficulty } from './ai.ts';
export function position(node:string):[number,number] {
 if(node===HOME)return [6,6];if(node===DONE)return [7,0];if(node==='c')return [0,0];
 const diagonal:Record<string,[number,number]>={a1:[-3.33,3.33],a2:[-1.67,1.67],b1:[-3.33,-3.33],b2:[-1.67,-1.67],d1:[1.67,1.67],d2:[3.33,3.33],e1:[1.67,-1.67],e2:[3.33,-3.33]};
 if(diagonal[node])return diagonal[node];const n=Number(node.slice(1));
 if(n<=5)return [5-n*2,5];if(n<=10)return [-5,5-(n-5)*2];if(n<=15)return [-5+(n-10)*2,-5];return [5,-5+(n-15)*2];
}
