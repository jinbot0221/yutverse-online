export * from './piece-types.ts';
export * from './target-effects.ts';
export * from './chat.ts';
import {sameCell,cellKey} from './fold.ts';
export * from './fold.ts';
export * from './dilemma.ts';
import {acquireCustom,startCustom,manualOptions,resolveCustom,customRoll,afterCustomThrow,customTurn,checkCustomWins,winSpecial,loseSpecial,killSpecial,own,special,nodes,hasCustomButton,nativeChoices,useNative,captureCustom,movementLocked,transformTarget,customLanding,type SpecialState} from './custom.ts';
export {REQUESTED_AUGMENTS} from './requested-augments.ts';
export {type Prompt,hasCustomButton,nativeChoices,nodes as BOARD_NODES} from './custom.ts';
import {available,candidates,definition,eligible,type Slot,type AugmentId,type GameStyle} from './augments.ts';
import {CHARACTERS,DEFAULT_CHARACTER,type CharacterId} from './characters.ts';
export * from './characters.ts';
export * from './augments.ts';
export type Result = { name: string; steps: number; extra: boolean; bonus?:number; id?:number; sticks?:boolean[];throwSticks?:boolean[]; extraSettled?:boolean };
export type Piece = { node: string; history: string[];kind?:string;shield?:number;life?:number;strength?:number;revive?:string;spirit?:boolean;bomb?:{round:number;owner:number};domainEnd?:number;frozenUntil?:number;frozenBy?:number;nativeUsed?:number;swallowedBy?:string;riding?:string;absorbed?:number[] };
export type Player = { name: string; pieces: Piece[]; slots:Slot[]; baseTurns:number;stats?:Record<string,number>;prediction?:number[];snipe?:string[]; character?:CharacterId };
export type Route='outer'|'diagonal'|'homeward'|'far';
export type PlayerCount = 2|3|4;
export type MoveEvent = {id:number;player:number;indices:number[];path:string[];captures:{player:number;indices:number[];from:string;to:string}[]};
export type State = { special?:SpecialState;players: Player[]; turn: number; phase: 'throw'|'move'|'augment'|'over'; result: Result|null; throws: number; ranks: number[]; log: string[]; turns: number; version:2; augmented:boolean;round?:number;gameStyle?:GameStyle; forfeited:number[]; selection:{player:number;offers:AugmentId[];deadline:number;rerolled?:boolean;queue:number[]}|null; choices:{player:number;id:AugmentId;turn:number;round?:number;at:number}[]; lastMove?:MoveEvent; pendingResults?:Result[]; lastThrow?:{id:number;player:number;result:Result;guarded?:boolean} };
export const HOME = 'home', DONE = 'done';
export function createGame(count: PlayerCount = 3, augmented=false, random:()=>number=Math.random, now=Date.now(),characters:CharacterId[]=[],gameStyle:GameStyle='normal'): State {
 if(![2,3,4].includes(count))throw Error('Player count must be 2, 3 or 4.');
 const state:State={version:2,round:1,augmented,gameStyle,forfeited:[],pendingResults:[],selection:null,choices:[],players:Array.from({length:count},(_,i)=>({name:i===0?'나':`AI ${i}`,slots:[],baseTurns:i===0?1:0,pieces:Array.from({length:4},()=>({node:HOME,history:[]}))})),turn:0,phase:'throw',result:null,throws:1,ranks:[],log:['새 경기가 시작되었습니다.'],turns:1};
 state.players.forEach((p,i)=>p.character=characters[i]??(i===0?DEFAULT_CHARACTER:CHARACTERS[(i-1)%CHARACTERS.length].id));
 return augmented?offer(state,Array.from({length:count},(_,i)=>i),random,now):state;
}
// Four independent fair sticks. One of the four sticks has the back-do mark.
export function roll(random:()=>number=Math.random): Result {
 const sticks=Array.from({length:4},()=>random()<0.5); const n=sticks.filter(Boolean).length;
 if(n===1 && sticks[0]) return {name:'빽도',steps:-1,extra:false,sticks};
 return {name:['모','도','개','걸','윷'][n],steps:n===0?5:n,extra:n===0||n===4,sticks};
}
const clone = (s:State):State => structuredClone(s);
function routesFor(piece:Piece,steps:number):{id:Route;label:string}[]{
 if(steps<=0)return [];
 if(piece.node==='o5'||piece.node==='o10')return [{id:'outer',label:'바깥길로 가기'},{id:'diagonal',label:'대각선 지름길로 가기'}];
 if(piece.node==='c')return [{id:'homeward',label:'도착점 쪽으로 가기'},{id:'far',label:'반대편 꼭짓점으로 가기'}];
 return [];
}
function nextNode(node:string,first:boolean,route:Route|undefined,from:string|undefined):string {
 if(node===HOME)return 'o1';if(node==='o20')return DONE;
 if(first&&node==='o5'&&route!=='outer')return 'a1';
 if(first&&node==='o10'&&route!=='outer')return 'b1';
 if(node==='a1')return 'a2';if(node==='b1')return 'b2';if(node==='a2'||node==='b2')return 'c';
 if(node==='c')return first?(route==='far'?'e1':'d1'):(from==='a2'?'e1':'d1');
 if(node==='d1')return 'd2';if(node==='d2')return 'o20';if(node==='e1')return 'e2';if(node==='e2')return 'o15';
 return `o${Number(node.slice(1))+1}`;
}
export function destination(p:Piece,steps:number,route?:Route):Piece|null {
 if(p.node===DONE)return null;
 if(route&&!routesFor(p,steps).some(r=>r.id===route))return null;
 if(steps<0){if(!p.history.length)return null;let history=[...p.history],node=p.node;for(let i=0;i<Math.abs(steps)&&history.length;i++){node=history.pop()!;if(node===HOME){node='o20';history=[HOME,...Array.from({length:19},(_,j)=>`o${j+1}`)];}}return {node,history};}
 let node=p.node;const history=[...p.history];
 for(let i=0;i<steps&&node!==DONE;i++){const from=history.at(-1);history.push(node);node=nextNode(node,i===0,route,from);}
 return {node,history};
}
export function legalMoves(s:State):number[]{
 if(s.special?.prompt||s.phase!=='move'||!s.result)return [];
 const seen=new Set<string>();return s.players[s.turn].pieces.flatMap((p,i)=>{
 if(!moveDestination(s,i)|| (p.node!==HOME&&seen.has(cellKey(s,p.node))))return [];
 seen.add(cellKey(s,p.node));return [i];
 });
}
function eliminated(s:State,i:number){return s.ranks.includes(i)||s.forfeited.includes(i);}
function finishMatch(s:State){
 const active=s.players.map((_,i)=>i).filter(i=>!eliminated(s,i));
 if(active.length>1)return false;
 s.ranks=[...s.ranks,...active,...[...s.forfeited].reverse()];const sp=s.special;if(sp){const assigned={...sp.fixedRanks,...sp.placements};for(const group of sp.lossGroups||[]){const rank=Math.min(...group.map(p=>s.ranks.indexOf(p)+1));for(const p of group)assigned[p]=rank;}const occupied=new Set(Object.values(assigned));for(const group of [...sp.wins||[],...sp.lossGroups||[]]){const rank=assigned[group[0]];for(let offset=0;offset<group.length;offset++)occupied.add(rank+offset);}for(const player of s.ranks)if(assigned[player]===undefined){const rank=Array.from({length:s.players.length},(_,n)=>n+1).find(n=>!occupied.has(n))||s.ranks.length;assigned[player]=rank;occupied.add(rank);}sp.placements=assigned;s.ranks.sort((a,b)=>assigned[a]-assigned[b]);for(let i=0;i<s.players.length;i++)if(s.players[i].prediction?.every((player,j)=>player===s.ranks[j])){sp.soleWinner=i;s.forfeited=s.forfeited.filter(p=>p!==i);sp.eliminations=sp.eliminations?.filter(p=>p!==i);s.ranks=[i,...s.ranks.filter(p=>p!==i)];sp.placements=Object.fromEntries(s.ranks.map((p,j)=>[p,j+1]));break;}}if(s.special){delete s.special.prompt;delete s.special.acquireQueue;delete s.special.checkpoint;}s.phase='over';s.selection=null;s.result=null;s.pendingResults=[];return true;
}
function offer(s:State,queue:number[],random:()=>number,now:number):State {
 const [player,...rest]=queue;
 if(player===undefined){const sp=s.special,mg=sp?.mindGame;if(mg&&mg.round===(s.round||1)&&Object.keys(mg.choices).length){const tally:Record<string,number>={};for(const id of Object.values(mg.choices))tally[id]=(tally[id]||0)+1;const highest=Math.max(...Object.values(tally));for(const [actor,id] of Object.entries(mg.choices)){const i=Number(actor);if(tally[id]===highest)s.players[i].slots=s.players[i].slots.filter(a=>a.id!==id);else{(sp!.acquireQueue??=[]).push({player:i,id});if(i===mg.owner)s.players[i].pieces.filter(p=>p.node===HOME).slice(0,2).forEach(p=>p.node=DONE);}}delete sp!.mindGame;}
 s.special?.acquireQueue?.sort((a,b)=>Number(b.id==='custom-detective')-Number(a.id==='custom-detective'));while(s.special?.acquireQueue?.length){const task=s.special.acquireQueue.shift()!;if(eliminated(s,task.player)||s.special.blocked?.includes(task.id))continue;acquireCustom(s,task.player,task.id,random,now);if(s.special.prompt)return s;}checkCustomWins(s);if(finishMatch(s))return s;s.phase='throw';s.selection=null;if(eliminated(s,s.turn)||(s.special?.checkpoint&&(s.players[s.turn].stats?.skip||0)>0)){if(s.special?.checkpoint&&!eliminated(s,s.turn)&&s.players[s.turn].stats?.skip)s.players[s.turn].stats!.skip--;if(s.special)delete s.special.checkpoint;s.throws=0;s.pendingResults=[];return advance(s,random,now);}if(s.special)delete s.special.checkpoint;return s;}
 if(s.players.length<3&&(s.gameStyle==='augment'))(special(s).blocked??=[]).push('custom-bronze');let offers=candidates(s.players[player].slots,random,s.gameStyle,s.round||1,s.special?.blocked);const mg=s.special?.mindGame;if(mg&&mg.round===(s.round||1)){if(!mg.offers.length)mg.offers=candidates([],random,s.gameStyle,s.round||1,[...s.players.flatMap(p=>p.slots.map(a=>a.id)),...(s.special?.blocked||[])]);offers=mg.offers as AugmentId[];}if(!offers.length)return offer(s,rest,random,now);
 const forced=(s.special?.catForced||own(s,player,'choose-cat'))&&!s.players[player].slots.some(a=>a.id==='custom-cat');if(forced&&s.gameStyle==='augment')offers[0]='custom-cat';
 const delivery=s.special?.delivered?.[player];if(delivery&&!s.special?.blocked?.includes(delivery)&&eligible(s.players[player].slots,definition(delivery)!,s.gameStyle)){offers[0]=delivery as AugmentId;delete s.special!.delivered![player];}
 offers=[...new Set(offers)];offers=[...offers,...candidates(s.players[player].slots,random,s.gameStyle,s.round||1,[...(s.special?.blocked||[]),...offers])].slice(0,3);
 s.phase='augment';s.selection={player,queue:rest,offers,deadline:now+60000,rerolled:false};return s;
}
export function selectAugment(state:State,player:number,id:string,random:()=>number=Math.random,now=Date.now()):State {
 const q=state.selection,def=definition(id);
 if(state.special?.prompt||state.phase!=='augment'||!q||q.player!==player||!def||!q.offers.includes(def.id)||!eligible(state.players[player].slots,def,state.gameStyle))return state;
 if(q.offers.includes('custom-cat')&&(state.special?.catForced||own(state,player,'choose-cat'))&&id!=='custom-cat')return state;
 const s=clone(state);s.players[player].slots.push({id:def.id,remaining:def.charges});s.choices.push({player,id:def.id,turn:s.players[player].baseTurns,round:s.round||1,at:now});
 s.log=[`${s.players[player].name}: ${def.name} 획득`,...s.log].slice(0,12);
 if(id==='custom-objection'){acquireCustom(s,player,id,random,now);return offer(s,[player,...q.queue],random,now);}
 if(id==='custom-chosen-cat')special(s).catForced=true;
 if(s.special?.mindGame?.round===(s.round||1))s.special.mindGame.choices[player]=id;else (special(s).acquireQueue??=[]).push({player,id});
 return offer(s,q.queue.filter(i=>!eliminated(s,i)),random,now);
}
export function rerollAugments(state:State,player:number,random:()=>number=Math.random,now=Date.now()):State {
 const q=state.selection;if(state.special?.prompt||state.phase!=='augment'||!q||q.player!==player||q.rerolled||now>=q.deadline)return state;
 if(state.special?.mindGame?.round===(state.round||1)){const s=clone(state);s.selection!.rerolled=true;return s;}
 const fresh=candidates(state.players[player].slots,random,state.gameStyle,state.round||1,[...(state.special?.blocked||[]),...q.offers]);const pool=[...fresh,...candidates(state.players[player].slots,random,state.gameStyle,state.round||1,state.special?.blocked).filter(id=>!fresh.includes(id))].slice(0,q.offers.length);
 if((state.special?.catForced||own(state,player,'choose-cat'))&&q.offers.includes('custom-cat'))pool[0]='custom-cat';
 if(!pool.length)return state;
 const s=clone(state);s.selection!.offers=pool;s.selection!.rerolled=true;return s;
}
export function activateNative(state:State,player:number,index:number,now=Date.now()):State{const s=clone(state);return useNative(s,player,index,now)?s:state;}
function finishCustomAction(s:State,random:()=>number,now:number):State{checkCustomWins(s);if(finishMatch(s)||s.special?.prompt)return s;if(eliminated(s,s.turn)){s.throws=0;s.pendingResults=[];s.result=null;return advance(s,random,now);}if(s.special?.consumeResult){s.special.consumeResult=false;consumeResult(s);return advance(s,random,now);}if(s.special?.endTurn){s.special.endTurn=false;s.throws=0;s.pendingResults=[];s.result=null;return advance(s,random,now);}if(s.phase==='move'&&!s.result&&s.pendingResults?.length)s.result=s.pendingResults[0];if(!s.selection&&!s.special?.prompt&&s.throws<=0){if(s.pendingResults?.length)return settleResults(s,random,now);return advance(s,random,now);}return s;}
export function resolveAbility(state:State,player:number,value:string,random:()=>number=Math.random,now=Date.now()):State{const s=clone(state);if(!resolveCustom(s,player,value,random,now))return state;checkCustomWins(s);if(finishMatch(s)||s.special?.prompt)return s;if(s.selection){const queue=s.selection.queue;return offer(s,queue.filter(i=>!eliminated(s,i)),random,now);}return finishCustomAction(s,random,now);}
export function expireAbility(state:State,now=Date.now(),random:()=>number=Math.random):State{const q=state.special?.prompt;if(!q||now<q.deadline)return state;let s=state;for(const player of q.voters||[q.owner]){if(q.answers&&Object.hasOwn(q.answers,player))continue;s=resolveAbility(s,player,q.options[0].value,random,q.deadline-1);}return s;}
export function expireSelection(s:State,now=Date.now(),random:()=>number=Math.random):State {
 if(s.special?.prompt||s.phase!=='augment'||!s.selection||now<s.selection.deadline)return s;
 return selectAugment(s,s.selection.player,s.selection.offers[0],random,now);
}
function advance(s:State,random:()=>number=Math.random,now=Date.now()):State {
 if(s.special?.prompt)return s;
 if(finishMatch(s))return s;
 if(!eliminated(s,s.turn)){if(s.throws>0){s.phase='throw';s.result=null;return s;}if(s.pendingResults?.length)return settleResults(s,random,now);}
 const previous=s.turn;const repeat=Boolean(s.special?.doubleTurns&&!s.special.extraTurn&&!eliminated(s,s.turn));if(s.special?.doubleTurns)s.special.extraTurn=repeat;if(!repeat)do{s.turn=(s.turn+1)%s.players.length;}while(eliminated(s,s.turn));
 const wrapped=!repeat&&s.turn<=previous;if(wrapped)s.round=(s.round??1)+1;
 s.turns++;s.throws=1;s.result=null;s.pendingResults=[];s.phase='throw';const p=s.players[s.turn];p.baseTurns++;customTurn(s,previous,wrapped,random);checkCustomWins(s);if(finishMatch(s))return s;
 if(s.augmented&&wrapped&&[6,12].includes(s.round!)){special(s).blocked=[];special(s).checkpoint=true;return offer(s,Array.from({length:s.players.length},(_,i)=>(s.turn+i)%s.players.length).filter(i=>!eliminated(s,i)),random,now);}
 if(eliminated(s,s.turn)||((p.stats?.skip||0)>0)){if(p.stats?.skip)p.stats.skip--;s.throws=0;s.pendingResults=[];return advance(s,random,now);}
 return s;
}
export function forfeit(state:State,player:number,random:()=>number=Math.random,now=Date.now()):State {
 if(state.phase==='over'||!state.players[player]||eliminated(state,player))return state;
 const s=clone(state);if(s.special?.prompt&&(s.special.prompt.owner===player||s.special.prompt.voters?.includes(player)))delete s.special.prompt;s.forfeited.push(player);const losses=[player];for(let n=0;n<losses.length;n++)for(const [f,target] of Object.entries(s.special?.linked||{}))if(target===losses[n]&&s.special?.linkedOnly?.includes(Number(f))&&!eliminated(s,Number(f))){const linked=Number(f);s.forfeited.push(linked);losses.push(linked);(special(s).eliminations??=[]).push(linked);}if(losses.length>1)(special(s).lossGroups??=[]).push(losses);if(s.special?.prompt&&(losses.includes(s.special.prompt.owner)||s.special.prompt.voters?.some(i=>losses.includes(i))))delete s.special.prompt;s.log=[`${s.players[player].name} 기권`,...s.log].slice(0,12);
 if(finishMatch(s))return s;
 const pending=s.selection?{...s.selection,queue:s.selection.queue.filter(i=>!eliminated(s,i))}:null;
 s.selection=null;
 if(eliminated(s,s.turn)){s.throws=0;s.result=null;s.pendingResults=[];advance(s,random,now);}
 if(pending){
  if(eliminated(s,pending.player))return offer(s,pending.queue,random,now);
  s.phase='augment';s.selection=pending;
 }
 return s;
}
function moveSteps(s:State,index:number):number {
 const p=s.players[s.turn].pieces[index];if(!p||!s.result)return 0;
 let steps=s.result.steps;
 if(steps>0){const slots=s.players[s.turn].slots;let bonus=s.result.bonus||0;
  if(available(slots,'hero-wind'))bonus++;
  if(available(slots,'do-plus')&&s.result.name==='도')bonus++;
  if(available(slots,'gae-plus')&&s.result.name==='개')bonus++;
  if(available(slots,'geol-plus')&&s.result.name==='걸')bonus++;
  if(available(slots,'launch')&&p.node===HOME)bonus++;
  if(available(slots,'late')&&/^o(16|17|18|19)$/.test(p.node))bonus++;
  if(available(slots,'stack')&&p.node!==HOME&&s.players[s.turn].pieces.filter(x=>sameCell(s,x.node,p.node)).length>1)bonus++;
  if(s.players[s.turn].pieces.some(t=>t.kind==='vanguard'&&nodes.includes(t.node)))bonus++;steps+=Math.min(2,bonus);
 }if(p.kind==='goblin')steps=1;if(own(s,s.turn,'moonwalk'))steps=-steps;if(s.players[s.turn].stats?.lastDance===s.players[s.turn].baseTurns)steps*=2;return steps;
}
export function moveDestination(s:State,index:number,route?:Route):Piece|null {const actual=s.players[s.turn].pieces[index],p=actual&&own(s,s.turn,'moonwalk')&&actual.node===HOME?{...actual,node:'o20',history:[HOME,...Array.from({length:19},(_,j)=>`o${j+1}`)]}:actual;return p&&s.result&&!movementLocked(s,s.turn,index)&&p.kind!=='pawn'?((target)=>target?transformTarget(s,s.turn,index,own(s,s.turn,'moonwalk')&&(target.node===HOME||(target.node==='o20'&&moveSteps(s,index)<0))?{...target,node:DONE}:target):null)(destination(p,moveSteps(s,index),route)):null;}
export function legalRoutes(s:State,index:number){const piece=s.players[s.turn].pieces[index];if(!piece||!s.result)return [];return routesFor(piece,moveSteps(s,index)).map(r=>({...r,destination:moveDestination(s,index,r.id)!.node}));}
function settleResults(s:State,random:()=>number,now:number):State {
 s.phase='move';
 while(s.pendingResults?.length){
  for(const result of s.pendingResults){s.result=result;if(legalMoves(s).length||['forward','reroll'].some(id=>canUseAugment(s,s.turn,id)))return s;}
  s.pendingResults.shift();
 }
 s.result=null;return advance(s,random,now);
}
export function selectResult(state:State,id:number):State {
 if(state.special?.prompt||state.phase!=='move'||state.result?.id===id)return state;const result=state.pendingResults?.find(r=>r.id===id);if(!result)return state;
 const s=clone(state);s.result=s.pendingResults!.find(r=>r.id===id)!;return s;
}
function consumeResult(s:State){const id=s.result?.id;if(id!==undefined)s.pendingResults=s.pendingResults?.filter(r=>r.id!==id)||[];s.result=null;}
function saveResult(s:State,oldId:number|undefined){
 if(!s.result||s.result.id===undefined)return;const pending=s.pendingResults||[];
 s.pendingResults=oldId!==undefined&&pending.some(r=>r.id===oldId)?pending.map(r=>r.id===oldId?s.result!:r):[...pending,s.result];
}
function addThrows(s:State,count:number){s.throws+=Math.max(0,Math.min(count,4-s.throws));}
export function canUseAugment(s:State,player:number,id:string,slotIndex?:number):boolean {
 if(slotIndex!==undefined&&(!Number.isInteger(slotIndex)||slotIndex<0||s.players[player]?.slots[slotIndex]?.id!==id||s.players[player].slots[slotIndex].remaining===0))return false;
 const def=definition(id);if(id==='custom-mutual'&&s.turn===player&&!s.special?.prompt&&['throw','move'].includes(s.phase)&&s.players.some((_,j)=>j!==player&&own(s,j,'mutual'))&&s.players[player].stats?.mutualUsed!==s.players[player].baseTurns)return true;
 if(s.special?.prompt||!def||(!def.manual&&!hasCustomButton(id))||s.turn!==player||eliminated(s,player)||!available(s.players[player].slots,def.id))return false;
 if(id.startsWith('custom-'))return manualOptions(s,player,id);
 if(['reserve','double-reserve','hero-pouch'].includes(id))return s.phase==='throw'&&s.throws<4;
 if(s.phase!=='move'||!s.result)return false;
 if(id==='forward')return s.result.steps===-1;
 if(id==='reroll')return true;
 if(id==='boost'||id==='leap')return s.result.steps>0&&(s.result.bonus||0)<2;
 return id==='steady'&&s.result.steps>0&&s.result.steps!==2;
}
export function useAugment(state:State,player:number,id:string,random:()=>number=Math.random,now=Date.now(),slotIndex?:number):State {
 if(!canUseAugment(state,player,id,slotIndex))return state;
 if(id.startsWith('custom-')){const s=clone(state);startCustom(s,player,id,random,now);return finishCustomAction(s,random,now);}
 const oldId=state.result?.id;
 const s=clone(state),slot=slotIndex===undefined?available(s.players[player].slots,id as AugmentId)!:s.players[player].slots[slotIndex];slot.remaining--;
 if(['reserve','double-reserve','hero-pouch'].includes(id))addThrows(s,id==='reserve'?1:id==='double-reserve'?2:3);
 else if(id==='reroll'){if(s.result!.extra&&!s.result!.extraSettled)s.throws=Math.max(0,s.throws-1);s.result={...roll(random),id:(s.lastThrow?.id||0)+1,extraSettled:true};if(s.result.extra)s.throws++;s.lastThrow={id:s.result.id!,player,result:structuredClone(s.result)};applyThrowAugments(s,s.result);if(guardBackDo(s,s.result)){s.pendingResults=s.pendingResults?.filter(r=>r.id!==oldId)||[];s.result=null;}}
 else if(id==='forward')s.result={...s.result!,steps:1,name:'도'};
 else if(id==='steady')s.result={...s.result!,steps:2,name:'고정 개',bonus:0};
 else s.result!.bonus=Math.min(2,(s.result!.bonus||0)+(id==='leap'?2:1));
 saveResult(s,oldId);
 s.log=[`${s.players[player].name}: ${definition(id)!.name} 사용`,...s.log].slice(0,12);
 if(s.throws>0&&id==='reroll'){s.phase='throw';s.result=null;return s;}
 if(s.phase==='move'&&!legalMoves(s).length&&!['forward','reroll'].some(id=>canUseAugment(s,s.turn,id))){consumeResult(s);return advance(s,random,now);}return s;
}
export function skipMove(state:State,random:()=>number=Math.random,now=Date.now()):State {if(state.special?.prompt||state.phase!=='move'||legalMoves(state).length)return state;const s=clone(state);consumeResult(s);return advance(s,random,now);}
function trigger(s:State,player:number,id:AugmentId,oncePerTurn=false):boolean {
 const slot=available(s.players[player].slots,id);if(!slot||(oncePerTurn&&slot.usedTurn===s.players[player].baseTurns))return false;
 if(slot.remaining>0)slot.remaining--;slot.usedTurn=s.players[player].baseTurns;return true;
}
function guardBackDo(s:State,result:Result){if(result.steps!==-1||!trigger(s,s.turn,'back-guard'))return false;s.throws++;if(s.lastThrow)s.lastThrow.guarded=true;s.log.unshift(`${s.players[s.turn].name}: 빽도 까방권 발동! 다시 던집니다.`);return true;}
function applyThrowAugments(s:State,result:Result){
 if(s.throws<4&&trigger(s,s.turn,'first-boost'))addThrows(s,1);
 if(s.throws<4&&s.players[s.turn].baseTurns>0&&s.players[s.turn].baseTurns%3===0&&trigger(s,s.turn,'steady-pocket',true))addThrows(s,1);
 if(s.throws<4&&result.name==='도'&&trigger(s,s.turn,'do-echo',true))addThrows(s,1);
 if(s.throws<4&&result.name==='모'&&trigger(s,s.turn,'mo-echo',true))addThrows(s,1);
}
export function throwYut(state:State,random:()=>number=Math.random,now=Date.now()):State {
 if(state.special?.prompt||state.phase!=='throw')return state;
 const s=clone(state),result:Result={...customRoll(s,random,()=>roll(random)),id:(state.lastThrow?.id||0)+1,extraSettled:true};
 s.throws--;if(result.extra)s.throws++;
 s.lastThrow={id:result.id!,player:s.turn,result:structuredClone(result)};
 applyThrowAugments(s,result);
 if(guardBackDo(s,result)){s.result=null;s.phase='throw';return s;}
 s.pendingResults=[...(s.pendingResults||[]),result];s.result=null;afterCustomThrow(s,result,random,now);checkCustomWins(s);if(finishMatch(s)||s.special?.prompt)return s;if(eliminated(s,s.turn)){s.throws=0;s.pendingResults=[];return advance(s,random,now);}
 s.log=[`${s.players[s.turn].name}: ${result.name}`,...s.log].slice(0,12);
 if(s.throws>0){s.phase='throw';return s;}return settleResults(s,random,now);
}
export function move(state:State,index:number,random:()=>number=Math.random,now=Date.now(),route?:Route):State {
 if(!legalMoves(state).includes(index)||!moveDestination(state,index,route))return state;
 const s=clone(state), player=s.players[s.turn], original=player.pieces[index], target=moveDestination(s,index,route)!;
 const group=player.pieces.map((p,i)=>({p,i})).filter(({p,i})=>i===index||(!own(s,s.turn,'cannibal')&&original.node!==HOME&&sameCell(s,p.node,original.node)));
 const path=s.result!.steps<0?[original.node,target.node]:[original.node,...target.history.slice(original.history.length+1),target.node];
 s.lastMove={id:(state.lastMove?.id||0)+1,player:s.turn,indices:group.map(({i})=>i),path,captures:[]};
 for(const {i} of group){const individual=transformTarget(s,s.turn,i,{...target,history:[...target.history]});player.pieces[i]={...player.pieces[i],node:individual.node,history:[...individual.history]};delete player.pieces[i].riding;}
 s.lastMove.indices=group.filter(({i})=>player.pieces[i].node===target.node).map(({i})=>i);
 if(target.node!==HOME&&target.node!==DONE&&!own(s,s.turn,'cannibal'))for(const piece of player.pieces)if(sameCell(s,piece.node,target.node)){piece.node=target.node;piece.history=[...target.history];}
 let captured=false;
 if(target.node!==HOME&&target.node!==DONE)s.players.forEach((op,i)=>{
  if(i===s.turn||eliminated(s,i)||!op.pieces.some(p=>sameCell(s,p.node,target.node)))return;
  if(trigger(s,i,'shield')||trigger(s,i,'hero-guard')){s.log.unshift(`${op.name}: 방패 발동`);return;}
  if(s.gameStyle==='augment'){if(captureCustom(s,s.turn,index,i,target.node)>0)captured=true;return;}
  const respawn=trigger(s,i,'hero-phoenix')?'o5':trigger(s,i,'return')?'o1':HOME;
  s.lastMove!.captures.push({player:i,indices:op.pieces.flatMap((p,j)=>sameCell(s,p.node,target.node)?[j]:[]),from:target.node,to:respawn});
  op.pieces=op.pieces.map(p=>sameCell(s,p.node,target.node)?{node:respawn,history:respawn===HOME?[]:[HOME]}:p);captured=true;
 });
 if(captured){s.throws++;if(s.throws<4&&trigger(s,s.turn,'hunter',true))s.throws++;s.log.unshift('잡기! 한 번 더 던집니다.');}
 if(target.node===DONE){if(s.throws<4&&trigger(s,s.turn,'finish'))s.throws++;if(s.throws<4&&trigger(s,s.turn,'hero-finish',true))s.throws++;}
 customLanding(s,s.turn,index,original.node,captured,target.node===DONE?group.filter(({i})=>player.pieces[i].node===DONE).length:0);
 if(!s.special?.linkedOnly?.includes(s.turn)&&!s.ranks.includes(s.turn)&&player.pieces.every(p=>p.node===DONE)){s.ranks.push(s.turn);s.throws=0;s.pendingResults=[];s.log.unshift(`${player.name} ${s.ranks.length}위 완주!`);}
 consumeResult(s);return advance(s,random,now);
}
export { chooseMove,chooseRoute, type Difficulty } from './ai.ts';
export function placement(s:State,player:number){return s.special?.placements?.[player]??s.special?.fixedRanks?.[player]??(s.ranks.indexOf(player)+1);}
export function position(node:string):[number,number] {
 if(node===HOME)return [6,6];if(node===DONE)return [7,0];if(node==='c')return [0,0];
 const diagonal:Record<string,[number,number]>={a1:[-3.33,3.33],a2:[-1.67,1.67],b1:[-3.33,-3.33],b2:[-1.67,-1.67],d1:[1.67,1.67],d2:[3.33,3.33],e1:[1.67,-1.67],e2:[3.33,-3.33]};
 if(diagonal[node])return diagonal[node];const n=Number(node.slice(1));
 if(n<=5)return [5-n*2,5];if(n<=10)return [-5,5-(n-5)*2];if(n<=15)return [-5+(n-10)*2,-5];return [5,-5+(n-15)*2];
}
