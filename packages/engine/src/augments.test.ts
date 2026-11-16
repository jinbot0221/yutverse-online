import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AUGMENTS,candidates,definition,createGame,selectAugment,expireSelection,throwYut,move,moveDestination,useAugment,canUseAugment,forfeit,legalMoves,skipMove,chooseMove,HOME,DONE,type State,type AugmentId,REQUESTED_AUGMENTS,resolveAbility} from './index.ts';
function state(...ids:AugmentId[]):State {const s=createGame();s.phase='move';s.result={name:'도',steps:1,extra:false};s.throws=0;s.players[0].slots=ids.map(id=>({id,remaining:definition(id)!.charges}));return s;}
function capture(id?:AugmentId){const s=state();s.players[0].pieces[0]={node:'o1',history:[HOME]};s.players[1].pieces[0]={node:'o2',history:[HOME,'o1']};if(id)s.players[1].slots=[{id,remaining:definition(id)!.charges}];return s;}
test('three current cards remain distinct, non-rechargeable and respect legacy slot limits',()=>{
 assert.equal(AUGMENTS.length,27+REQUESTED_AUGMENTS.length);assert.equal(new Set(AUGMENTS.map(a=>a.id)).size,27+REQUESTED_AUGMENTS.length);
 const slots=[{id:'hero-wind' as const,remaining:-1},{id:'shield' as const,remaining:0}];
 for(let i=0;i<30;i++){const offers=candidates(slots,Math.random);assert.equal(offers.length,2);assert.deepEqual([...offers].sort(),['back-guard','boost']);}
 assert.deepEqual(candidates(['do-plus','gae-plus','geol-plus','launch','late'].map(id=>({id:id as AugmentId,remaining:0})),Math.random),[]);
});
test('selection freezes the whole game and timeout selects only at 60 seconds',()=>{
 const s=createGame(3,true,()=>.5,100);assert.equal(s.phase,'augment');assert.equal(throwYut(s),s);assert.equal(move(s,0),s);assert.equal(useAugment(s,0,'reserve'),s);
 assert.equal(selectAugment(s,1,s.selection!.offers[0]),s);assert.equal(selectAugment(s,0,'not-real'),s);assert.equal(expireSelection(s,60099),s);
 const next=expireSelection(s,60100,()=>.5);assert.equal(next.players[0].slots.length,1);assert.equal(next.selection!.player,1);assert.equal(next.selection!.deadline,120100);
});
test('rounds 1,6,12 offer all active players once; extra throws do not advance rounds',()=>{
 for(const count of [2,3,4] as const)for(const style of ['normal','augment'] as const){
 let s=createGame(count,true,()=>.3,0,[],style);while(s.selection)s=selectAugment(s,s.selection.player,s.selection.offers[0],()=>.3,0);
 assert.equal(s.round,1);s.phase='throw';s=throwYut(s,()=>.1);assert.equal(s.round,1);
 for(let round=2;round<=13;round++){s.turn=count-1;s.round=round-1;s.pendingResults=[];s.phase='move';s.selection=null;s.result={name:'도',steps:1,extra:false};s.throws=0;s.players[count-1].pieces=s.players[count-1].pieces.map(()=>({node:HOME,history:[]}));s=move(s,0,()=>.3,0);assert.equal(s.round,round);assert.equal(s.phase,[6,12].includes(round)?'augment':'throw');const actors=[];while(s.selection){actors.push(s.selection.player);s=selectAugment(s,s.selection.player,s.selection.offers[0],()=>.3,0);}if([6,12].includes(round))assert.deepEqual(actors,Array.from({length:count},(_,i)=>i));}
 for(const p of s.players){assert.equal(p.slots.length,3);assert.equal(new Set(p.slots.map(x=>x.id)).size,3);}
 }
});
test('all passive movement bonuses, stacking and +2 cap',()=>{
 for(const id of ['do-plus','gae-plus','geol-plus','launch','late','stack','hero-wind'] as AugmentId[]){
  const s=state(id);if(id==='gae-plus')s.result={name:'개',steps:2,extra:false};if(id==='geol-plus')s.result={name:'걸',steps:3,extra:false};
  if(id==='late')s.players[0].pieces[0]={node:'o16',history:[]};
  if(id==='stack'){s.players[0].pieces[0]={node:'o1',history:[]};s.players[0].pieces[1]={node:'o1',history:[]};}
  const start=id==='late'?16:id==='stack'?1:0;assert.equal(moveDestination(s,0)!.node,`o${start+s.result!.steps+1}`,id);
 }
 const s=state('do-plus','launch','hero-wind','boost');s.result!.bonus=2;assert.equal(moveDestination(s,0)!.node,'o3');
 s.result={name:'빽도',steps:-1,extra:false};assert.equal(moveDestination(s,0),null);
});
test('shield and hero guard prevent capture per group, consume correct charges and retain slots',()=>{
 for(const id of ['shield','hero-guard'] as AugmentId[]){const s=capture(id);s.players[1].pieces[1]=structuredClone(s.players[1].pieces[0]);const next=move(s,0);assert.equal(next.players[1].pieces[0].node,'o2');assert.equal(next.players[1].pieces[1].node,'o2');assert.equal(next.players[1].slots[0].remaining,definition(id)!.charges-1);assert.equal(next.turn,1);assert.equal(next.players[1].slots.length,1);}
 const s=capture('shield');s.players[1].slots[0].remaining=0;assert.equal(move(s,0).players[1].pieces[0].node,HOME);
});
test('return and phoenix respawn captured pieces; hunter only once per basic turn',()=>{
 for(const [id,node] of [['return','o1'],['hero-phoenix','o5']] as const){const s=capture(id);const n=move(s,0);assert.equal(n.players[1].pieces[0].node,node);assert.equal(n.players[1].slots[0].remaining,0);assert.equal(n.turn,0);}
 const s=capture();s.players[0].slots=[{id:'hunter',remaining:-1}];let n=move(s,0);assert.equal(n.throws,2);n.phase='move';n.result={name:'도',steps:1,extra:false};n.throws=0;n.players[1].pieces[0]={node:'o3',history:[]};n=move(n,0);assert.equal(n.throws,1);
});
test('finish rewards one-shot and once-per-basic-turn heroes',()=>{
 for(const id of ['finish','hero-finish'] as AugmentId[]){const s=state(id);s.players[0].pieces[0]={node:'o20',history:[]};const n=move(s,0);assert.equal(n.throws,1);assert.equal(n.turn,0);assert.equal(n.players[0].pieces[0].node,DONE);assert.equal(n.players[0].slots[0].remaining,id==='finish'?0:-1);}
});
test('manual movement augments, turn ownership and consumed slot rejection',()=>{
 for(const [id,expected] of [['boost','o2'],['leap','o3'],['forward','o1'],['steady','o2']] as const){const s=state(id);if(id==='forward')s.result={name:'빽도',steps:-1,extra:false};if(id==='steady')s.result={name:'모',steps:5,extra:true};assert.equal(useAugment(s,1,id),s);const n=useAugment(s,0,id);assert.equal(moveDestination(n,0)!.node,expected);assert.equal(n.players[0].slots[0].remaining,0);assert.equal(useAugment(n,0,id),n);}
 const s=state('reserve');assert.equal(canUseAugment(s,0,'reserve'),false);s.phase='throw';s.throws=1;const n=useAugment(s,0,'reserve');assert.equal(n.throws,2);assert.equal(n.players[0].slots[0].remaining,0);
});
test('reroll replaces extra throw accounting rather than stacking rewards',()=>{const s=state('reroll');s.result={name:'모',steps:5,extra:true};s.throws=1;let i=0;const n=useAugment(s,0,'reroll',()=>[.9,.1,.9,.9][i++]);assert.equal(n.result!.name,'도');assert.equal(n.throws,0);});
test('back-do at home can be converted or skipped without a deadlock',()=>{
 const s=state('forward');s.phase='throw';s.throws=1;let i=0;const n=throwYut(s,()=>[.1,.9,.9,.9][i++]);assert.equal(n.phase,'move');assert.equal(legalMoves(n).length,0);assert.equal(useAugment(n,0,'forward').result!.steps,1);assert.equal(skipMove(n).turn,1);
});
test('forfeit while selecting never leaves an eliminated player active; bottom ranks follow forfeit order',()=>{
 let s=createGame(4,true);s=forfeit(s,0);while(s.selection)s=selectAugment(s,s.selection.player,s.selection.offers[0]);assert.equal(s.turn,1);s=forfeit(s,2);s=forfeit(s,3);assert.equal(s.phase,'over');assert.deepEqual(s.ranks,[1,3,2,0]);
});
test('normal and supplied-augment two/three/four-player AI games complete with valid ranks',()=>{
 for(const style of ['normal','augment'] as const)for(const count of [2,3,4] as const)for(let seed=1;seed<=12;seed++){
  let v=seed;const rng=()=>{v=(v*1664525+1013904223)>>>0;return v/4294967296};let s=createGame(count,true,rng,Date.now(),[],style),actions=0;
  while(s.phase!=='over'&&actions++<10000){
   if(s.special?.prompt){const q=s.special.prompt,actor=(q.voters||[q.owner]).find(i=>!Object.hasOwn(q.answers||{},i))!;s=resolveAbility(s,actor,q.options[0].value,rng,q.deadline-1);}
   else if(s.selection)s=selectAugment(s,s.selection.player,s.selection.offers[0],rng);
   else if(s.phase==='throw')s=throwYut(s,rng);
   else {const slot=s.players[s.turn].slots.find(a=>canUseAugment(s,s.turn,a.id)&&(!a.id.startsWith('custom-')||a.usedTurn!==s.players[s.turn].baseTurns));s=slot?useAugment(s,s.turn,slot.id,rng):legalMoves(s).length?move(s,chooseMove(s,'hard',rng),rng):skipMove(s,rng);}
  }
  assert.equal(s.phase,'over');assert.equal(new Set(s.ranks).size,count);for(const p of s.players){assert.ok(p.slots.length<=10);assert.ok(p.slots.filter(x=>definition(x.id)!.hero).length<=1);}
 }
});
test('conflicting defenses cannot be selected, even if an invalid offer is supplied',()=>{
 for(const [owned,rejected] of [['shield','hero-guard'],['return','hero-phoenix']] as const){const s=createGame(3,true);s.players[0].slots=[{id:owned,remaining:0}];s.selection!.offers=[rejected,'boost','leap'];assert.equal(selectAugment(s,0,rejected),s);}
});
test('additional-throw augments never decrease earned throws or consume charges at their cap',()=>{
 const s=capture();s.players[0].slots=[{id:'hunter',remaining:-1}];s.throws=4;assert.equal(move(s,0).throws,5);
 const n=state('finish');n.throws=4;n.players[0].pieces[0]={node:'o20',history:[]};const out=move(n,0);assert.equal(out.throws,4);assert.equal(out.players[0].slots[0].remaining,1);
});
test('rerolling into back-do leaves a remaining forward card usable',()=>{
 const s=state('reroll','forward');let i=0;const n=useAugment(s,0,'reroll',()=>[.1,.9,.9,.9][i++]);assert.equal(n.phase,'move');assert.equal(canUseAugment(n,0,'forward'),true);
});
