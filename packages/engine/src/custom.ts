import {destination,position,type State,type Piece,type Result} from './index.ts';
import {REQUESTED_AUGMENTS} from './requested-augments.ts';
export type Prompt={owner:number;id:string;title:string;options:{value:string;label:string}[];deadline:number;step?:string;data?:Record<string,unknown>;answers?:Record<number,string>;voters?:number[]};
export type SpecialState={checkpoint?:boolean;acquireQueue?:{player:number;id:string}[];prompt?:Prompt;endTurn?:boolean;consumeResult?:boolean;rotation?:number;fold?:'horizontal'|'vertical';catForced?:boolean;blocked?:string[];delivered?:Record<number,string>;reaper?:{owner:number;node:string};hazards?:{owner:number;node:string;kind:'poop'|'trap'|'reward'|'garlic'}[];fogUntil?:number;fogOwner?:number;doubleTurns?:boolean;extraTurn?:boolean;linkedOnly?:number[];linked?:Record<number,number>;placements?:Record<number,number>;fixedRanks?:Record<number,number>;eliminations?:number[];lossGroups?:number[][];soleWinner?:number;wins?:number[][];attackHp?:boolean;mindGame?:{owner:number;round:number;offers:string[];choices:Record<number,string>};duels?:{owner:number;target:number;end:number;done:number}[]};
export const nodes=[...Array.from({length:20},(_,i)=>`o${i+1}`),'a1','a2','b1','b2','c','d1','d2','e1','e2'];
export const active=(s:State,i:number)=>Boolean(s.players[i])&&!s.ranks.includes(i)&&!s.forfeited.includes(i);
export const own=(s:State,i:number,key:string)=>Boolean(s.players[i]?.slots.some(a=>a.id===`custom-${key}`&&a.remaining!==0));
const stats=(s:State,i:number)=>s.players[i].stats??= {};
export const special=(s:State)=>s.special??={};
function log(s:State,message:string){s.log=[message,...s.log].slice(0,12)}
function addResult(s:State,i:number,steps:number,name:string){if(s.turn!==i){stats(s,i)[`owed-${steps}`]=(stats(s,i)[`owed-${steps}`]||0)+1;return;}const result:Result={steps,name,extra:false,id:-(1+s.turns*100+(stats(s,i).serial=(stats(s,i).serial||0)+1)),extraSettled:true};s.pendingResults=[...(s.pendingResults||[]),result];if(s.phase==='move'&&!s.result)s.result=result;return result;}
function take(s:State,i:number,id:string){const slot=s.players[i].slots.find(a=>a.id===id);if(slot&&slot.remaining>0)slot.remaining--;}
function ask(s:State,owner:number,id:string,title:string,options:Prompt['options'],now:number,step?:string,data?:Prompt['data']){if(options.length)special(s).prompt={owner,id,title,options,deadline:now+60000,step,data};}
function pieces(s:State,i:number,filter:(p:Piece)=>boolean=()=>true){return s.players[i].pieces.flatMap((p,j)=>filter(p)?[{value:`${i}:${j}`,label:`${s.players[i].name} · 말 ${j+1} (${p.node==='home'?'대기':p.node==='done'?'완주':p.node})`}]:[])}
function targets(s:State,i:number,includeSelf=false){return s.players.flatMap((p,j)=>(includeSelf||j!==i)&&active(s,j)?[{value:String(j),label:p.name}]:[])}
function promptPiece(s:State,i:number,id:string,now:number,filter:(p:Piece)=>boolean=(p=>p.node!=='done')){ask(s,i,id,'효과를 적용할 내 말을 고르세요',pieces(s,i,filter),now)}
function complete(s:State,i:number,count:number){const home=s.players[i].pieces.filter(p=>p.node==='home');for(const p of home.slice(0,count))p.node='done';}
export function winSpecial(s:State,i:number){if(!active(s,i)||(s.special?.linkedOnly?.includes(i)&&active(s,s.special.linked?.[i]??-1)))return;const sp=special(s),group=[i];for(let n=0;n<group.length;n++)for(const [f,t] of Object.entries(sp.linked||{}))if(t===group[n]&&active(s,Number(f))&&!group.includes(Number(f)))group.push(Number(f));const occupied=new Set(Object.values({...sp.fixedRanks,...sp.placements}));for(const old of sp.wins||[]){const rank=sp.placements?.[old[0]]||1;for(let offset=0;offset<old.length;offset++)occupied.add(rank+offset);}const rank=Array.from({length:s.players.length},(_,n)=>n+1).find(n=>!occupied.has(n))||s.ranks.length+1;for(const n of group){(sp.placements??={})[n]=rank;s.ranks.push(n);log(s,`${s.players[n].name}: 특수 승리 · ${rank}위`)}(sp.wins??=[]).push(group);}
export function loseSpecial(s:State,i:number){if(!active(s,i))return;s.forfeited.push(i);(special(s).eliminations??=[]).push(i);const losses=[i];log(s,`${s.players[i].name}: 증강 효과로 탈락`);for(let n=0;n<losses.length;n++)for(const [f,t] of Object.entries(s.special?.linked||{}))if(t===losses[n]&&s.special?.linkedOnly?.includes(Number(f))&&active(s,Number(f))){s.forfeited.push(Number(f));losses.push(Number(f));(special(s).eliminations??=[]).push(Number(f));}if(losses.length>1)(special(s).lossGroups??=[]).push(losses);}
export function killSpecial(s:State,attacker:number,victim:number,index:number):boolean{
 const p=s.players[victim]?.pieces[index];if(!p||p.node==='home'||p.node==='done'||(attacker!==victim&&(own(s,attacker,'peace')||own(s,victim,'peace'))))return false;
 if(p.shield){p.shield--;return false;}if(p.kind==='monster'){stats(s,victim).monsterGoal=(stats(s,victim).monsterGoal||12)+1;return false;}
 if(p.kind==='queen'&&(p.life||1)>1){p.life!--;return false;}
 if(p.kind==='queen'||p.kind==='domain')loseSpecial(s,victim);
 for(const op of s.players)for(const t of op.pieces)if(t.swallowedBy===`${victim}:${index}`){delete t.swallowedBy;t.node='home';t.history=[];}const to=p.revive||'home';const from=p.node;p.node=to;p.history=[];delete p.revive;delete p.spirit;delete p.riding;
 if(attacker>=0){stats(s,attacker).kills=(stats(s,attacker).kills||0)+1;stats(s,victim)[`caught-${attacker}`]=1;
 if(attacker!==victim&&own(s,attacker,'coup')&&(stats(s,attacker).coupKills=(stats(s,attacker).coupKills||0)+1)>=4)winSpecial(s,attacker);
 if(attacker!==victim&&own(s,attacker,'monster')&&stats(s,attacker).kills>=(stats(s,attacker).monsterGoal||12))winSpecial(s,attacker);
 if(attacker!==victim&&own(s,attacker,'murder')){stats(s,victim).hp=(stats(s,victim).hp??4)-1;if(stats(s,victim).hp<=0)loseSpecial(s,victim);}
 }
 for(let j=0;j<s.players.length;j++)if(j!==s.turn&&j!==victim&&own(s,j,'fisher')){const st=stats(s,j);st.fisher=(st.fisher||0)+1;if(st.fisher%2===0)addResult(s,j,2,'개');}
 if(s.lastMove)s.lastMove.captures.push({player:victim,indices:[index],from,to});return true;
}
export function acquireCustom(s:State,i:number,id:string,rng:()=>number,now:number){
 if(!id.startsWith('custom-'))return;const key=id.slice(7),sp=special(s),p=s.players[i],st=stats(s,i);const def=REQUESTED_AUGMENTS.find(a=>a.id===id);if(def&&!def.manual&&def.charges>0)take(s,i,id);
 if(key==='cat-lover'&&s.players.some(p=>p.slots.some(a=>a.id==='custom-cat')))winSpecial(s,i);
 if(key==='no-friends')for(const k of Object.keys(st))if(k.startsWith('caught-'))delete st[k];
 if(key==='coup')st.coupKills=0;
 if(key==='cat'){for(let j=0;j<s.players.length;j++)if(own(s,j,'cat-lover'))winSpecial(s,j);}
 if(key==='chosen-cat')sp.catForced=true;
 if(key==='fold')ask(s,i,id,'윷판 접는 방향을 고르세요',[{value:'horizontal',label:'가로로 접기'},{value:'vertical',label:'세로로 접기'}],now);
 if(key==='spin'){const turns=1+Math.floor(rng()*3);rotatePieces(s,turns);sp.rotation=(sp.rotation||0)+turns;ask(s,i,id,'한 번 더 돌릴까요?',[{value:'keep',label:'현재 방향 유지'},{value:'spin',label:'한 번 더 돌리기'}],now);}
 if(['leech','duel'].includes(key))ask(s,i,id,'상대 플레이어를 고르세요',targets(s,i),now);
 if(key==='identity'){ask(s,i,id,'원래 내 색을 맞혀 보세요',['yellow','green','blue','red'].slice(0,s.players.length).map((x,j)=>({value:String(j),label:['노랑','초록','파랑','분홍'][j]})),now);if(special(s).prompt)special(s).prompt!.voters=targets(s,i).map(x=>Number(x.value));}
 if(key==='not-me'){const victims=s.players.flatMap((_,j)=>active(s,j)?[j]:[]),victim=victims[Math.floor(rng()*victims.length)];for(let j=0;j<s.players[victim].pieces.length;j++)killSpecial(s,i,victim,j);}
 if(key==='red-button')s.players.forEach((op,j)=>op.pieces.forEach((piece,k)=>{if(/^[abde][12]$/.test(piece.node)||piece.node==='c')killSpecial(s,i,j,k)}));
 if(key==='reaper')sp.reaper={owner:i,node:'c'};
 if(['detective','delivery'].includes(key))ask(s,i,id,key==='delivery'?'다음에 받을 증강을 고르세요':'이번 선택에서 무효화할 증강을 고르세요',REQUESTED_AUGMENTS.filter(a=>a.id!==id&&(key!=='delivery'||a.stage!=='start')).map(a=>({value:a.id,label:a.name})),now);
 if(key==='mind-game')sp.mindGame={owner:i,round:(s.round||1)<6?6:12,offers:[],choices:{}};
 if(key==='exchange')p.pieces.pop();
 if(key==='burden')p.pieces.push({node:'home',history:[]});
 if(key==='speed'){s.players.forEach(op=>{op.pieces=op.pieces.slice(0,2)});p.pieces[0]={node:'o1',history:['home']};p.pieces[1]={node:'o2',history:['home','o1']};}
 if(key==='stack-start')p.pieces.forEach(piece=>{piece.node='o1';piece.history=['home']});
 if(key==='star')p.pieces=Array.from({length:8},()=>({node:'home',history:[],kind:'star',strength:1}));
 if(key==='monster'){p.pieces=[{node:'home',history:[],kind:'monster'}];st.monsterGoal=12;}
 if(key==='kim'){p.pieces[0].kind='kim';st.kimEnd=p.baseTurns+6;}
 if(key==='queen'){p.pieces[0]={node:'o10',history:['home'],kind:'queen',life:1};st.queenThrows=0;}
 if(key==='adventurer'){['goblin','vanguard','cannon','pawn'].forEach((kind,j)=>{if(p.pieces[j])p.pieces[j].kind=kind});st.adventureEnd=(s.round||1)+8;}
 if(key==='bear'){sp.hazards??=[];const placed=[...nodes];for(let n=placed.length-1;n>0;n--){const j=Math.floor(rng()*(n+1));[placed[n],placed[j]]=[placed[j],placed[n]];}for(const node of placed.slice(0,4))sp.hazards.push({owner:i,node,kind:'garlic'});}
 if(key==='party'){sp.hazards??=[];const chosen=[...nodes].sort(()=>rng()-.5).slice(0,10);chosen.forEach((node,j)=>sp.hazards!.push({owner:i,node,kind:j<6?'trap':'reward'}));}
 if(key==='summon')p.pieces.forEach(piece=>{if(!piece.kind&&piece.node!=='done')piece.kind='cultist'});
 if(key==='echo')sp.doubleTurns=true;
 if(key==='murder'){sp.attackHp=true;s.players.forEach((_,j)=>stats(s,j).hp??=4);}
 if(key==='bronze'){winSpecial(s,i);for(const actor of sp.wins?.at(-1)||[i]){(sp.fixedRanks??={})[actor]=Math.min(3,s.players.length);(sp.placements??={})[actor]=Math.min(3,s.players.length);}}
 if(key==='plan'){ask(s,i,id,'예상 순서를 첫 순위부터 선택하세요',targets(s,i,true),now,'ranking',{order:[]});}
 if(key==='reversal'){const pool=REQUESTED_AUGMENTS.filter(a=>a.stage!=='start'&&(s.players.length>=3||a.id!=='custom-bronze')&&a.id!==id&&!p.slots.some(slot=>slot.id===a.id));for(let j=0;j<4&&pool.length;j++){const a=pool.splice(Math.floor(rng()*pool.length),1)[0];p.slots.push({id:a.id as `custom-${string}`,remaining:a.charges});s.choices.push({player:i,id:a.id as `custom-${string}`,turn:p.baseTurns,round:s.round||1,at:now});(sp.acquireQueue??=[]).push({player:i,id:a.id});}}
 if(key==='objection'){p.slots=p.slots.filter(a=>a.id!==id);(sp.blocked??=[]).push(id);}
}
export function manualOptions(s:State,i:number,id:string):boolean{
 if(s.special?.prompt||!active(s,i)||s.turn!==i||!['throw','move'].includes(s.phase))return false;const key=id.slice(7),p=s.players[i];
 if(hasCustomButton(id)&&s.players[i].slots.find(a=>a.id===id)?.usedTurn===s.players[i].baseTurns)return false;
 if(key==='hypnosis')return s.phase==='move'&&Boolean(s.result);
 if(['goblin','vanguard','zombie','cannon','pawn','pelican'].includes(key))return p.pieces.some(x=>!x.kind&&x.node!=='done');
 if(key==='marathon')return p.pieces.some(x=>!x.kind&&x.node==='home');
 if(['holy-shield','bonfire','assassin','bomb','domain','sacrifice','time-travel','flick'].includes(key))return p.pieces.some(x=>nodes.includes(x.node));
 if(key==='truck')return p.pieces.some(x=>nodes.includes(x.node)&&p.pieces.filter(y=>y.node===x.node).length>=2);
 if(key==='fusion')return p.pieces.some(x=>nodes.includes(x.node)&&p.pieces.filter(y=>y.node===x.node).length>=3);
 if(['quick-hands','loner','bluff'].includes(key))return s.phase==='throw';
 if(key==='flip')return s.phase==='move'&&Boolean(s.result?.sticks?.length);
 if(['loan','chalice','sniper'].includes(key))return s.phase==='throw'&&s.throws>0;
 if(key==='necromancer')return Boolean(s.forfeited.length);
 if(key==='cancel-wins')return Boolean(s.ranks.length);
 return true;
}
export function startCustom(s:State,i:number,id:string,rng:()=>number,now:number){
 const key=id.slice(7),sp=special(s),p=s.players[i],st=stats(s,i);const used=p.slots.find(a=>a.id===id);if(used)used.usedTurn=p.baseTurns;const onBoard=(piece:Piece)=>nodes.includes(piece.node);
 if(key==='dog-pig')ask(s,i,id,'이번 던지기 결과를 고르세요',[{value:'1',label:'도'},{value:'2',label:'개'}],now);
 else if(key==='hitchhike')ask(s,i,id,'상대 말을 만났을 때 행동을 고르세요',[{value:'0',label:'잡기'},{value:'1',label:'무임승차'}],now);
 else if(key==='hypnosis')ask(s,i,id,'내 결과로 움직일 상대 말을 고르세요',s.players.flatMap((_,j)=>j!==i?pieces(s,j,t=>t.node!=='done'&&Boolean(destination(t,s.result!.steps))):[]),now);
 else if(key==='mutual'){const owner=s.players.findIndex((_,j)=>j!==i&&own(s,j,'mutual'));if(owner>=0){addResult(s,i,2,'개');stats(s,owner)['owed-3']=(stats(s,owner)['owed-3']||0)+1;st.mutualUsed=p.baseTurns;}}
 else if(['goblin','vanguard','zombie','cannon','pawn','pelican'].includes(key))promptPiece(s,i,id,now,x=>!x.kind&&x.node!=='done');
 else if(key==='marathon')promptPiece(s,i,id,now,x=>!x.kind&&x.node==='home');
 else if(['holy-shield','bonfire','assassin','bomb','domain','sacrifice','time-travel','flick'].includes(key))promptPiece(s,i,id,now,onBoard);
 else if(['truck','fusion'].includes(key))promptPiece(s,i,id,now,x=>onBoard(x)&&p.pieces.filter(y=>y.node===x.node).length>=(key==='truck'?2:3));
 else if(['hit-player','wait','illusion'].includes(key))ask(s,i,id,'상대 플레이어를 고르세요',targets(s,i),now);
 else if(key==='necromancer')ask(s,i,id,'부활시킬 플레이어를 고르세요',s.forfeited.map(j=>({value:String(j),label:s.players[j].name})),now);
 else if(key==='sniper')ask(s,i,id,'다음 내 차례에 공격할 칸을 고르세요',nodes.map(node=>({value:node,label:node})),now);
 else if(key==='quick-hands'||key==='bluff')ask(s,i,id,'다음 결과를 고르세요',['빽도','도','개','걸','윷','모'].map((label,j)=>({value:String([-1,1,2,3,4,5][j]),label})),now);
 else if(key==='flip')ask(s,i,id,'뒤집을 윷을 고르세요',s.result!.sticks!.map((face,j)=>({value:String(j),label:`윷 ${j+1} · ${face?'앞면':'뒷면'}`})),now);
 else if(key==='vote'){ask(s,i,id,'차례를 쉬게 할 플레이어에 투표하세요',targets(s,i,true),now);if(special(s).prompt)special(s).prompt!.voters=targets(s,i,true).map(x=>Number(x.value));}
 else if(key==='dilemma')ask(s,i,id,'첫 번째 참가자를 고르세요',targets(s,i,true),now,'first');
 else if(key==='dogs'){take(s,i,id);addResult(s,i,2,'개');}
 else if(key==='loan'){take(s,i,id);s.throws++;st.skip=(st.skip||0)+1;}
 else if(key==='doberman'){take(s,i,id);st.coins=st['roll-개']||0;st.doberman=1;}
 else if(key==='loner'){take(s,i,id);st.loner=1;}
 else if(key==='fog'){take(s,i,id);sp.fogOwner=i;sp.fogUntil=s.turns+2;}
 else if(key==='poop'){take(s,i,id);(sp.hazards??=[]).push({owner:i,kind:'poop',node:nodes[Math.floor(rng()*nodes.length)]});}
 else if(key==='chalice'){s.throws+=3;st.chalice=p.baseTurns;}
 else if(key==='last-dance'){take(s,i,id);s.throws+=2;st.lastDance=p.baseTurns;}
 else if(key==='cancel-wins'){take(s,i,id);s.ranks=[];sp.placements={};sp.fixedRanks={};sp.wins=[];s.players.forEach(op=>op.pieces.forEach(piece=>{if(piece.node==='done'){piece.node='home';piece.history=[]}}));}
 else if(key==='go'){const groups=[...new Set(p.pieces.map(x=>x.node).filter(n=>nodes.includes(n)))];let killed=0;for(let a=0;a<groups.length;a++)for(let b=a+1;b<groups.length;b++){const u=position(groups[a]),v=position(groups[b]);s.players.forEach((op,j)=>{if(j!==i)op.pieces.forEach((piece,k)=>{if(!onBoard(piece))return;const z=position(piece.node),cross=(v[0]-u[0])*(z[1]-u[1])-(v[1]-u[1])*(z[0]-u[0]);if(Math.abs(cross)<.08&&(z[0]-u[0])*(z[0]-v[0])+(z[1]-u[1])*(z[1]-v[1])<0&&killSpecial(s,i,j,k))killed++;})});}if(killed){take(s,i,id);s.throws+=killed;}}
}
function shiftGroup(s:State,i:number,j:number,node:string){const origin=s.players[i].pieces[j].node;s.lastMove={id:(s.lastMove?.id||0)+1,player:i,indices:s.players[i].pieces.flatMap((p,k)=>k===j||(origin!=='home'&&p.node===origin)?[k]:[]),path:[origin,node],captures:[]};for(const [k,p] of s.players[i].pieces.entries())if(k===j||(origin!=='home'&&p.node===origin)){p.history.push(p.node);p.node=node;}}
function rotatePieces(s:State,turns:number){for(const op of s.players)for(const p of op.pieces)if(nodes.includes(p.node)){let [x,y]=position(p.node);for(let j=0;j<turns;j++)[x,y]=[-y,x];p.node=nearest(x,y);p.history=[];}}
function nearest(x:number,y:number){return [...nodes].sort((a,b)=>{const u=position(a),v=position(b);return Math.hypot(u[0]-x,u[1]-y)-Math.hypot(v[0]-x,v[1]-y)})[0]}
function ray(s:State,from:string,to:string){const a=position(from),b=position(to),dx=b[0]-a[0],dy=b[1]-a[1];if(Math.abs(dx)>.05&&Math.abs(dy)>.05&&Math.abs(Math.abs(dx)-Math.abs(dy))>.05)return [];return nodes.filter(n=>{const p=position(n),vx=p[0]-a[0],vy=p[1]-a[1];return n!==from&&Math.abs(dx*vy-dy*vx)<.09&&dx*vx+dy*vy>0}).sort((u,v)=>{const p=position(u),q=position(v);return Math.hypot(p[0]-a[0],p[1]-a[1])-Math.hypot(q[0]-a[0],q[1]-a[1])})}
export function resolveCustom(s:State,actor:number,value:string,rng:()=>number,now:number):boolean{
 const sp=special(s),q=sp.prompt;if(!q||!(q.voters?q.voters.includes(actor)&&!Object.hasOwn(q.answers||{},actor):q.owner===actor)||!q.options.some(x=>x.value===value)||now>=q.deadline)return false;
 const i=q.owner,id=q.id,key=id.slice(7),st=stats(s,i);delete sp.prompt;
 if(q.voters){q.answers??={};q.answers[actor]=value;if(q.voters.some(j=>!Object.hasOwn(q.answers!,j))){sp.prompt=q;return true;}
 if(key==='vote'){const votes=new Map<number,number>();for(const [v,target] of Object.entries(q.answers))votes.set(Number(target),(votes.get(Number(target))||0)+(Number(v)===i?2:1));const winner=[...votes].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0][0];stats(s,winner).skip=(stats(s,winner).skip||0)+1;take(s,i,id);}
 if(key==='identity')for(const [j,a] of Object.entries(q.answers))if(Number(j)!==Number(a))stats(s,Number(j)).skip=(stats(s,Number(j)).skip||0)+1;
 if(key==='dilemma'){const pair=q.voters,choices=pair.map(j=>q.answers![j]);for(let j=0;j<2;j++){const reward=choices[j]==='cooperate'?(choices[1-j]==='cooperate'?2:0):(choices[1-j]==='cooperate'?3:1);s.throws+=s.turn===pair[j]?reward:0;stats(s,pair[j]).owedThrows=(stats(s,pair[j]).owedThrows||0)+(s.turn===pair[j]?0:reward);}take(s,i,id);}
 if(key==='bluff-resolve'){const actual=q.data!.actual as Result,declared=q.data!.declared as number,truth=actual.steps===declared,challenged=Object.values(q.answers).includes('lie');if(truth){for(const [v,a] of Object.entries(q.answers))if(a==='lie')stats(s,Number(v)).skip=(stats(s,Number(v)).skip||0)+1;s.pendingResults=[...(s.pendingResults||[]),actual];}else if(!challenged){s.throws+=Number(declared>=4)-Number(actual.extra);s.pendingResults=[...(s.pendingResults||[]),{...actual,steps:declared,name:declared===-1?'빽도':['','도','개','걸','윷','모'][declared],extra:declared>=4}];}if(truth||!challenged){const final=s.pendingResults?.at(-1);if(final)afterCustomThrow(s,final,rng,now);}if(!truth&&challenged&&actual.extra)s.throws=Math.max(0,s.throws-1);if(s.throws===0)s.phase='move';s.result=s.pendingResults?.[0]??null;}
 return true;}
 if(key==='native'){const index=Number(q.data!.index),piece=s.players[i].pieces[index],to=piece.kind==='goblin'?destination(piece,value==='back'?-1:1):{node:value,history:[...piece.history,piece.node]};if(to){const original=piece.node;shiftGroup(s,i,index,to.node);piece.nativeUsed=s.players[i].baseTurns;let captured=false;s.players.forEach((op,j)=>{if(j!==i&&op.pieces.some(p=>p.node===to.node)&&captureCustom(s,i,index,j,to.node)>0)captured=true;});if(captured)s.throws++;customLanding(s,i,index,original,captured,to.node==='done'?1:0);sp.consumeResult=true;}}
 else if(key==='dog-pig')st.dogChoice=Number(value);
 else if(key==='hitchhike')st.ride=Number(value);
 else if(key==='hypnosis'){const [owner,index]=value.split(':').map(Number),piece=s.players[owner].pieces[index],to=destination(piece,s.result!.steps);if(to){shiftGroup(s,owner,index,to.node);s.players.forEach((op,j)=>{if(j!==owner&&op.pieces.some(t=>t.node===to.node))captureCustom(s,owner,index,j,to.node)});sp.consumeResult=true;}}
 else if(key==='fold'){sp.fold=value as 'horizontal'|'vertical';for(const p of s.players)for(const t of p.pieces)if(nodes.includes(t.node)){const [x,y]=position(t.node);t.node=nearest(sp.fold==='vertical'?-Math.abs(x):x,sp.fold==='horizontal'?-Math.abs(y):y);t.history=[];}}
 else if(key==='spin'){if(value==='spin'){const turns=1+Math.floor(rng()*3);rotatePieces(s,turns);sp.rotation=(sp.rotation||0)+turns;}}
 else if(key==='leech'){const target=Number(value),piece=Math.max(0,s.players[i].pieces.findIndex(p=>p.node==='home'));if(piece>=0)s.players[Number(value)].pieces.push(s.players[i].pieces.splice(piece,1)[0]);(sp.linked??={})[i]=target;(sp.linkedOnly??=[]).push(i);}
 else if(key==='duel'){const target=Number(value);(sp.duels??=[]).push({owner:i,target,end:s.players[target].baseTurns+3,done:s.players[target].pieces.filter(p=>p.node==='done').length});}
 else if(key==='delivery')(sp.delivered??={})[i]=value;
 else if(key==='detective'){(sp.blocked??=[]).push(value);for(const choice of s.choices)if(choice.id===value&&choice.round===(s.round||1))s.players[choice.player].slots=s.players[choice.player].slots.filter(a=>a.id!==value);complete(s,i,2);}
 else if(key==='plan'){const order=[...(q.data?.order as number[]||[]),Number(value)];if(order.length<s.players.length)ask(s,i,id,`예상 ${order.length+1}위를 고르세요`,targets(s,i,true).filter(x=>!order.includes(Number(x.value))),now,'ranking',{order});else s.players[i].prediction=order;}
 else if(key==='hit-player'){stats(s,Number(value)).skip=(stats(s,Number(value)).skip||0)+2;take(s,i,id);}
 else if(key==='wait'){const op=s.players[Number(value)],front=op.pieces.filter(p=>nodes.includes(p.node)).sort((a,b)=>a.history.length-b.history.length).at(-1);if(front)for(const piece of op.pieces)if(piece.node===front.node)piece.frozenUntil=(s.round||1)+2;take(s,i,id);}
 else if(key==='illusion'){if(!q.step)ask(s,i,id,'고양이로 바꿀 증강을 고르세요',s.players[Number(value)].slots.flatMap((a,j)=>a.remaining!==0?[{value:String(j),label:REQUESTED_AUGMENTS.find(x=>x.id===a.id)?.name||a.id}]:[]),now,'slot',{player:Number(value)});else{const slot=s.players[Number(q.data!.player)].slots[Number(value)];slot.original=slot.id;slot.restoreRound=(s.round||1)+3;slot.id='custom-cat';take(s,i,id);}}
 else if(key==='necromancer'){const target=Number(value);s.forfeited=s.forfeited.filter(j=>j!==target);sp.eliminations=sp.eliminations?.filter(j=>j!==target);sp.lossGroups=sp.lossGroups?.map(g=>g.filter(j=>j!==target)).filter(g=>g.length>1);s.ranks=s.ranks.filter(j=>j!==target);s.players[target].pieces.forEach(p=>{if(p.node==='done'){p.node='home';p.history=[]}});(sp.linked??={})[i]=target;take(s,i,id);}
 else if(key==='sniper'){(s.players[i].snipe??=[]).push(value);take(s,i,id);s.throws--;}
 else if(key==='quick-hands'){st.forced=Number(value);st.forceReady=1;take(s,i,id);}
 else if(key==='bluff'){st.bluff=Number(value);st.bluffReady=1;take(s,i,id);}
 else if(key==='flip'){const result=s.result!,faces=[...result.sticks!];faces[Number(value)]=!faces[Number(value)];const wasExtra=result.extra,changed=fromFaces(s,i,faces);Object.assign(result,changed);if(!wasExtra&&changed.extra)s.throws++;s.pendingResults=s.pendingResults?.map(r=>r.id===result.id?result:r);if(s.throws>0){s.phase='throw';s.result=null;}take(s,i,id);}
 else if(key==='dilemma'){if(q.step==='first')ask(s,i,id,'두 번째 참가자를 고르세요',targets(s,i,true).filter(x=>x.value!==value),now,'second',{first:Number(value)});else{ask(s,i,id,'협력 또는 배신을 고르세요',[{value:'cooperate',label:'협력'},{value:'betray',label:'배신'}],now,'vote');if(special(s).prompt)special(s).prompt!.voters=[Number(q.data!.first),Number(value)];}}
 else {
 const [owner,index]=value.split(':').map(Number),piece=s.players[owner]?.pieces[index];
 if(q.step==='back'){const [j,k]=(q.data!.piece as string).split(':').map(Number);const p=s.players[j].pieces[k];p.node=value;p.history=p.history.slice(0,p.history.indexOf(value));take(s,i,id);}
 else if(q.step==='ray'){const [j,k]=(q.data!.piece as string).split(':').map(Number),from=s.players[j].pieces[k].node,path=ray(s,from,value);if(key==='flick'){const victim=path.flatMap(n=>s.players.flatMap((p,v)=>p.pieces.flatMap((t,w)=>t.node===n&&v!==i?[{v,w}]:[])))[0];if(victim)killSpecial(s,i,victim.v,victim.w);shiftGroup(s,j,k,path[0]||from);}else{let end=from;for(const node of path){if(s.players.some(p=>p.pieces.some(t=>t.node===node)))break;end=node;}shiftGroup(s,j,k,end);}take(s,i,id);sp.endTurn=true;}
 else if(!piece)return false;
 else if(['goblin','vanguard','zombie','cannon','pawn','pelican','marathon'].includes(key)){piece.kind=key;take(s,i,id);}
 else if(['holy-shield','bonfire','assassin','bomb','domain'].includes(key)){const group=s.players[owner].pieces.filter((p,j)=>j===index||p.node===piece.node);for(const p of group){if(key==='holy-shield')p.shield=(p.shield||0)+1;if(key==='bonfire')p.revive=piece.node;if(key==='assassin')p.spirit=true;if(key==='bomb')p.bomb={round:(s.round||1)+6,owner:i};if(key==='domain'){p.kind='domain';p.domainEnd=s.players[i].baseTurns+2;}}take(s,i,id);}
 else if(key==='sacrifice'){piece.shield=0;killSpecial(s,i,i,index);for(const p of s.players[i].pieces)if(nodes.includes(p.node))p.shield=(p.shield||0)+1;take(s,i,id);}
 else if(key==='fusion'){s.players.forEach((op,j)=>op.pieces.forEach((p,k)=>{if(j!==owner||p.node!==piece.node)killSpecial(s,i,j,k)}));take(s,i,id);sp.endTurn=true;}
 else if(key==='time-travel'){ask(s,i,id,'戻る 칸을 고르세요',[...new Set(piece.history)].map(node=>({value:node,label:node==='home'?'대기칸':node})),now,'back',{piece:value});}
 else if(key==='truck'||key==='flick')ask(s,i,id,'직선 이동 방향을 고르세요',nodes.filter(n=>n!==piece.node&&ray(s,piece.node,n).length).map(node=>({value:node,label:`${node} 방향`})),now,'ray',{piece:value});
 }
 return true;
}
function fromFaces(s:State,i:number,faces:boolean[]):Result{const n=faces.filter(Boolean).length;if(faces.length===6&&n===6){if(!own(s,i,'no-drop')){loseSpecial(s,i);return {name:'탈락',steps:0,extra:false,sticks:faces};}faces[0]=false;return fromFaces(s,i,faces);}if(own(s,i,'dual')&&faces.length===2)return {name:n===2?'개':'도',steps:n===2?2:1,extra:false,sticks:faces};const steps=n===0?5:n===1&&faces[0]?-1:((faces.length===6&&n===5)||(faces.length!==6&&n===faces.length))?4:n,extra=n===0||(faces.length===6?n===5:n===faces.length);return {name:steps===-1?'빽도':(faces.length>4&&n===4)?'넉':steps===5?'모':['','도','개','걸','윷'][steps]||`${steps}칸`,steps,extra,sticks:faces};}
export function customRoll(s:State,rng:()=>number,base:()=>Result):Result{
 const i=s.turn,p=s.players[i],st=stats(s,i);let result=base();
 if(st.forceReady){const steps=st.forced;delete st.forceReady;return {name:steps===-1?'빽도':['','도','개','걸','윷','모'][steps],steps,extra:steps>=4};}
 if(own(s,i,'dog-pig'))return {name:st.dogChoice===1?'도':'개',steps:st.dogChoice===1?1:2,extra:false};
 if(own(s,i,'mo-do'))return rng()<.5?{name:'모',steps:5,extra:true}:{name:'도',steps:1,extra:false};
 if(st.doberman&&st.coins>=2){st.coins-=2;return {name:'모',steps:5,extra:true};}
 const count=own(s,i,'excess')?6:own(s,i,'burden')?5:own(s,i,'exchange')?3:4;
 if(count!==4){const faces=Array.from({length:count},()=>rng()<.5);if(count===6&&faces.every(Boolean)&&own(s,i,'no-drop')){const mask=Math.floor(rng()*63);for(let j=0;j<6;j++)faces[j]=Boolean(mask&(1<<j));}result=fromFaces(s,i,faces);}
 if(st.loner){delete st.loner;const faces=Array.from({length:count},()=>true);faces[Math.floor(rng()*count)]=false;result=fromFaces(s,i,faces);}
 if(own(s,i,'dual')){const faces=[rng()<.5,rng()<.5],secondFaces=[rng()<.5,rng()<.5],n=faces.filter(Boolean).length,n2=secondFaces.filter(Boolean).length;result={name:n===2?'개':'도',steps:n===2?2:1,extra:false,sticks:faces,throwSticks:[...faces,...secondFaces]};const second=addResult(s,i,n2===2?2:1,n2===2?'개':'도');if(second)second.sticks=secondFaces;}
 return result;
}
export function afterCustomThrow(s:State,result:Result,rng:()=>number,now:number){const i=s.turn,st=stats(s,i); if(st.bluffReady){delete st.bluffReady;s.pendingResults=s.pendingResults?.filter(r=>r.id!==result.id)||[];ask(s,i,'custom-bluff-resolve',`${s.players[i].name}님의 선언: ${st.bluff===-1?'빽도':['','도','개','걸','윷','모'][st.bluff]}. 진실인가요?`,[{value:'truth',label:'진실'},{value:'lie',label:'거짓'}],now,undefined,{actual:result,declared:st.bluff});if(s.special!.prompt)s.special!.prompt!.voters=targets(s,i).map(x=>Number(x.value));}if(s.special?.prompt?.id==='custom-bluff-resolve')return;st[`roll-${result.name}`]=(st[`roll-${result.name}`]||0)+1;st[`turn-roll-${result.name}`]=(st[`turn-roll-${result.name}`]||0)+1;
 if(own(s,i,'777')&&st[`turn-roll-${result.name}`]>=3)winSpecial(s,i);
 if(own(s,i,'score')&&['빽도','도','개','걸','윷','모'].every(name=>st[`roll-${name}`]>0))winSpecial(s,i);
 if(own(s,i,'rhythm')&&result.name==='걸'){st.rhythm=(st.rhythm||0)+1;if(st.rhythm%2===0)addResult(s,i,2,'개');}
 if(own(s,i,'queen')){st.queenThrows=(st.queenThrows||0)+1;if(st.queenThrows>=12)winSpecial(s,i);}
 if(st.chalice===s.players[i].baseTurns&&result.name==='모')loseSpecial(s,i);
 for(const [j,p] of s.players[i].pieces.entries())if(p.kind==='pawn'&&p.node!=='done'){const target=destination(p,1);if(target){Object.assign(p,target);let captured=false;s.players.forEach((op,v)=>{if(v!==i&&op.pieces.some(piece=>piece.node===p.node)&&captureCustom(s,i,j,v,p.node)>0)captured=true;});if(captured)s.throws++;}}

}
export function customTurn(s:State,previous:number,wrapped:boolean,rng:()=>number){const sp=special(s),i=s.turn,p=s.players[i],st=stats(s,i);
 if(stats(s,previous).lastDance===s.players[previous].baseTurns)loseSpecial(s,previous);
 if(wrapped){for(const [j,op] of s.players.entries()){const ost=stats(s,j);if(ost.adventureEnd&&(s.round||1)>=ost.adventureEnd)loseSpecial(s,j);for(const slot of op.slots)if(slot.original&&(s.round||1)>=(slot.restoreRound||0)){slot.id=slot.original;delete slot.original;delete slot.restoreRound;}for(const piece of op.pieces)if(piece.bomb&&(s.round||1)>=piece.bomb.round)loseSpecial(s,j);}
 const reaper=sp.reaper;if(reaper){const available=s.players.flatMap((op,j)=>j!==reaper.owner&&active(s,j)?op.pieces.filter(p=>nodes.includes(p.node)).map(p=>p.node):[]);if(available.length){const at=position(reaper.node),target=available.sort((a,b)=>{const u=position(a),v=position(b);return Math.hypot(u[0]-at[0],u[1]-at[1])-Math.hypot(v[0]-at[0],v[1]-at[1])})[0],goal=position(target);reaper.node=nodes.filter(n=>{const u=position(n);return Math.hypot(u[0]-at[0],u[1]-at[1])<=2.4}).sort((a,b)=>{const u=position(a),v=position(b);return Math.hypot(u[0]-goal[0],u[1]-goal[1])-Math.hypot(v[0]-goal[0],v[1]-goal[1])})[0]||reaper.node;s.players.forEach((op,j)=>{if(j!==reaper.owner)op.pieces.forEach((t,k)=>{if(t.node===reaper.node)killSpecial(s,reaper.owner,j,k)})})}}
 }
 for(const key of Object.keys(st))if(key.startsWith('turn-roll-'))delete st[key];
 if(st.kimEnd&&p.baseTurns>=st.kimEnd&&!p.pieces.some(t=>t.kind==='kim'&&t.node==='done'))loseSpecial(s,i);
 if(p.snipe){for(const cell of p.snipe)s.players.forEach((op,j)=>op.pieces.forEach((t,k)=>{if(t.node===cell)killSpecial(s,i,j,k)}));delete p.snipe;}
 for(const piece of p.pieces)if(piece.kind==='domain'&&p.baseTurns>=(piece.domainEnd||Infinity))winSpecial(s,i);
 const cult=p.pieces.filter(t=>t.kind==='cultist'&&t.node!=='done').length;st.ritual=(st.ritual||0)+cult;if(cult&&st.ritual>=12)winSpecial(s,i);
 s.throws+=st.owedThrows||0;st.owedThrows=0;for(const [steps,name] of [[2,'개'],[3,'걸']] as const){for(let n=0;n<(st[`owed-${steps}`]||0);n++)addResult(s,i,steps,name);st[`owed-${steps}`]=0;}
 for(const duel of sp.duels||[])if(duel.target===previous&&s.players[previous].baseTurns>=duel.end){if(s.players[previous].pieces.filter(t=>t.node==='done').length>duel.done)loseSpecial(s,duel.owner);else loseSpecial(s,previous);}sp.duels=sp.duels?.filter(d=>active(s,d.owner)&&active(s,d.target));
}
export function checkCustomWins(s:State){
 for(const duel of s.special?.duels||[])if(s.players[duel.target].pieces.filter(t=>t.node==='done').length>duel.done)loseSpecial(s,duel.owner);
 for(let i=0;i<s.players.length;i++){if(!active(s,i))continue;const p=s.players[i],st=stats(s,i),board=p.pieces.filter(t=>nodes.includes(t.node));
 if(p.pieces.some(t=>['marathon','kim'].includes(t.kind||'')&&t.node==='done'))winSpecial(s,i);
 if(own(s,i,'connect-four')&&(board.some(t=>board.filter(x=>x.node===t.node).length>=4)||nodes.some(a=>nodes.some(b=>a!==b&&[a,...ray(s,a,b)].slice(0,4).length===4&&[a,...ray(s,a,b)].slice(0,4).every(n=>board.some(t=>t.node===n))))))winSpecial(s,i);
 if(own(s,i,'star')&&board.some(t=>board.filter(x=>x.node===t.node).reduce((n,x)=>n+(x.strength||1),0)>=8))winSpecial(s,i);
 if(own(s,i,'no-friends')&&s.players.every((_,j)=>j===i||st[`caught-${j}`]>0))winSpecial(s,i);
 if(own(s,i,'sole')){const groups=new Set(s.players.flatMap((op,j)=>op.pieces.filter(t=>nodes.includes(t.node)).map(t=>`${j}:${t.node}`)));if(groups.size===1&&board.length)winSpecial(s,i);}
 if(own(s,i,'zombie')){const all=s.players.flatMap(op=>op.pieces);if(all.filter(t=>t.kind==='zombie').length*2>=all.length)winSpecial(s,i);}
 if(p.pieces.every(t=>t.node==='done'))winSpecial(s,i);
 }
}
export function captureCustom(s:State,i:number,index:number,victim:number,target:string):number{
 const piece=s.players[i].pieces[index],op=s.players[victim];if(own(s,i,'peace')||own(s,victim,'peace'))return 0;
 const indices=op.pieces.flatMap((t,j)=>t.node===target?[j]:[]);if(own(s,i,'hitchhike')&&stats(s,i).ride&&indices.length){piece.riding=`${victim}:${indices[0]}`;return 1;}let count=0;
 for(const k of own(s,victim,'friend-shield')?indices.slice(0,1):indices){const enemy=op.pieces[k];const bombCarrier=s.players[i].pieces.find(p=>p.node===piece.node&&p.bomb);
 if(piece.kind==='pelican'){(piece.absorbed??=[]).push(victim);enemy.node='home';enemy.history=[];enemy.swallowedBy=`${i}:${index}`;if(bombCarrier?.bomb){enemy.bomb=bombCarrier.bomb;delete bombCarrier.bomb;}count++;continue;}
 if(killSpecial(s,i,victim,k)){if(bombCarrier?.bomb){enemy.bomb=bombCarrier.bomb;delete bombCarrier.bomb;}count++;if(piece.kind==='zombie')enemy.kind='zombie';}
 }
 if(count&&own(s,i,'treason')&&op.pieces.filter(t=>t.node==='done').length>s.players[i].pieces.filter(t=>t.node==='done').length)s.throws++;
 return count;
}
export function transformTarget(s:State,i:number,index:number,target:Piece):Piece{
 const old=s.players[i].pieces[index],sp=s.special;const path=[...target.history.slice(old.history.length+1),target.node];
 const block=path.find(n=>sp?.hazards?.some(h=>h.kind==='poop'&&h.owner!==i&&h.node===n));if(block){const at=target.history.indexOf(block,old.history.length);target.node=block;target.history=at<0?target.history:target.history.slice(0,at);}
 if(sp?.fold&&nodes.includes(target.node)){const [x,y]=position(target.node);target.node=nearest(sp.fold==='vertical'?-Math.abs(x):x,sp.fold==='horizontal'?-Math.abs(y):y);}
 if(old.kind==='monster'&&target.node==='done')return {node:'o1',history:['home'],kind:'monster'};if(old.kind==='queen'&&target.node==='done')return {...old};return target;
}
export function customLanding(s:State,i:number,index:number,original:string,captured:boolean,finished:number){
 const p=s.players[i],piece=p.pieces[index],sp=special(s),st=stats(s,i),node=piece.node;
 for(const op of s.players)for(const rider of op.pieces)if(rider.riding===`${i}:${index}`){rider.node=node;rider.history=[...piece.history];}
 if(piece.kind==='pelican'&&node==='done')for(const victim of piece.absorbed||[])loseSpecial(s,victim);
 if(captured&&s.result?.steps===-1&&own(s,i,'back-catch')){st.backCatch=(st.backCatch||0)+1;if(st.backCatch>=2)winSpecial(s,i);}
 if(finished){if(st.adventureEnd)st.adventureEnd+=finished;for(const queen of p.pieces)if(queen.kind==='queen')queen.life=(queen.life||1)+finished;}
 for(const hazard of [...sp.hazards||[]])if(hazard.node===node){if(hazard.kind==='garlic'&&hazard.owner===i){st.garlic=(st.garlic||0)+1;sp.hazards=sp.hazards!.filter(h=>h!==hazard);if(st.garlic>=4)winSpecial(s,i);}if(hazard.kind==='trap'&&hazard.owner!==i)killSpecial(s,hazard.owner,i,index);if(hazard.kind==='reward'){const target=destination(piece,2);if(target)Object.assign(piece,target);}}
 if(sp.reaper?.node===node&&sp.reaper.owner!==i)killSpecial(s,sp.reaper.owner,i,index);
 s.players.forEach((op,j)=>op.pieces.forEach((t,k)=>{if(j!==i&&t.spirit&&s.lastMove?.path.includes(t.node)){for(const moved of s.lastMove.indices)killSpecial(s,j,i,moved);delete t.spirit;}}));
 if(own(s,i,'cannibal')){const group=new Set(s.lastMove?.indices);for(const [j,t] of p.pieces.entries())if(!group.has(j)&&t.node===node&&killSpecial(s,i,i,j))s.throws++;}
 checkCustomWins(s);
}
export function hasCustomButton(id:string){return ['custom-dog-pig','custom-hitchhike','custom-hypnosis','custom-mutual'].includes(id);}
export function nativeChoices(s:State,i:number,index:number){const p=s.players[i]?.pieces[index];if(!p||i!==s.turn||s.special?.prompt||s.phase!=='move'||!s.result||p.nativeUsed===s.players[i].baseTurns||!nodes.includes(p.node))return [];
 if(p.kind==='goblin')return [{value:'forward',label:'앞으로 한 칸'},{value:'back',label:'뒤로 한 칸'}].filter(x=>destination(p,x.value==='back'?-1:1));
 if(p.kind==='cannon')return nodes.filter(n=>{const path=ray(s,p.node,n),at=path.indexOf(n);return at>=0&&path.slice(0,at).filter(cell=>s.players.some(op=>op.pieces.some(t=>t.node===cell))).length===1}).map(node=>({value:node,label:`${node}로 포 이동`}));return [];
}
export function useNative(s:State,i:number,index:number,now:number){const options=nativeChoices(s,i,index);if(!options.length)return false;ask(s,i,'custom-native','특수말 이동을 선택하세요',options,now,undefined,{index});return true;}
