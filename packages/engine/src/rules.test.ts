import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,throwYut,move,destination,legalRoutes,selectResult,canUseAugment,useAugment,definition,type State,type AugmentId} from './index.ts';
function ready(node='o5'):State{const s=createGame(2);s.phase='move';s.throws=0;s.result={name:'개',steps:2,extra:false};s.players[0].pieces[0]={node,history:[]};return s;}
const rollBits=(bits:boolean[])=>{let i=0;return()=>bits[i++]?.1:.9};
test('first-corner diagonal passes through center to the opposite corner, second-corner diagonal heads home',()=>{
 assert.equal(destination({node:'o5',history:[]},6,'diagonal')!.node,'o15');assert.equal(destination({node:'o10',history:[]},6,'diagonal')!.node,'o20');
 assert.equal(destination({node:'o5',history:[]},2,'outer')!.node,'o7');assert.equal(destination({node:'o10',history:[]},2,'outer')!.node,'o12');
});
test('only a turn beginning on a fork offers routes; the center offers both forward exits',()=>{
 assert.deepEqual(legalRoutes(ready(),0).map(r=>r.id),['outer','diagonal']);assert.deepEqual(legalRoutes(ready('c'),0).map(r=>r.id),['homeward','far']);
 assert.equal(move(ready('c'),0,Math.random,Date.now(),'homeward').players[0].pieces[0].node,'d2');assert.equal(move(ready('c'),0,Math.random,Date.now(),'far').players[0].pieces[0].node,'e2');
 assert.deepEqual(legalRoutes(ready('o15'),0),[]);assert.equal(destination({node:'o4',history:[]},2)!.node,'o6');assert.equal(destination({node:'o4',history:[]},2,'diagonal'),null);
});
test('back-do retraces the chosen branch and does not offer a forward fork choice',()=>{
 const p=destination({node:'o5',history:['home','o1','o2','o3','o4']},2,'outer')!;assert.equal(destination(p,-1)!.node,'o6');
 const s=ready();s.result={name:'빽도',steps:-1,extra:false};assert.deepEqual(legalRoutes(s,0),[]);
});
test('yut and mo are rolled again before moving, and saved results can be spent in a chosen order',()=>{
 let s=createGame(2);s=throwYut(s,()=>.9);assert.equal(s.phase,'throw');assert.equal(s.pendingResults!.length,1);assert.equal(move(s,0),s);
 s=throwYut(s,rollBits([false,true,true,false]));assert.equal(s.phase,'move');assert.equal(s.pendingResults!.length,2);
 const moId=s.pendingResults![0].id!,gaeId=s.pendingResults![1].id!;s=selectResult(s,gaeId);s=move(s,0);assert.equal(s.players[0].pieces[0].node,'o2');assert.equal(s.turn,0);assert.equal(s.pendingResults!.length,1);assert.equal(s.result!.id,moId);
 s=move(s,1);assert.equal(s.turn,1);assert.equal(s.pendingResults!.length,0);
});
test('back-do is kept when another saved result can bring a waiting piece onto the board',()=>{
 let s=createGame(2);s=throwYut(s,()=>.9);s=throwYut(s,rollBits([true,false,false,false]));assert.equal(s.pendingResults!.length,2);
 const backId=s.pendingResults!.find(r=>r.steps===-1)!.id!;s=move(s,0);assert.equal(s.result!.id,backId);assert.equal(s.players[0].pieces[0].node,'o5');s=move(s,0);assert.equal(s.players[0].pieces[0].node,'o4');
});
test('new manual throw cards add chances up to four and remain consumed in their slots',()=>{
 for(const [id,chances] of [['double-reserve',3],['hero-pouch',4]] as const){const s=createGame(2);s.players[0].slots=[{id,remaining:1}];const out=useAugment(s,0,id);assert.equal(out.throws,chances);assert.equal(out.players[0].slots[0].remaining,0);assert.equal(canUseAugment(out,0,id),false);}
 const s=createGame(2);s.throws=3;s.players[0].slots=[{id:'hero-pouch',remaining:1}];assert.equal(useAugment(s,0,'hero-pouch').throws,4);
});
test('new automatic throw cards grant fair extra chances, once per applicable basic turn',()=>{
 const cases:[AugmentId,boolean[],number][]=[['first-boost',[false,true,false,false],1],['steady-pocket',[false,true,false,false],3],['do-echo',[false,true,false,false],1],['mo-echo',[false,false,false,false],1]];
 for(const [id,bits,baseTurn] of cases){let s=createGame(2);s.players[0].baseTurns=baseTurn;s.players[0].slots=[{id,remaining:definition(id)!.charges}];s=throwYut(s,rollBits(bits));assert.equal(s.phase,'throw',id);assert.equal(s.throws,id==='mo-echo'?2:1,id);if(id==='first-boost')assert.equal(s.players[0].slots[0].remaining,0);}
 let s=createGame(2);s.players[0].slots=[{id:'do-echo',remaining:-1}];s=throwYut(s,rollBits([false,true,false,false]));s=throwYut(s,rollBits([false,true,false,false]));assert.equal(s.phase,'move');assert.equal(s.pendingResults!.length,2);
});
test('rerolling a stored yut does not subtract an extra throw that was already used',()=>{
 let s=createGame(2);s.players[0].slots=[{id:'reroll',remaining:1}];s=throwYut(s,()=>.9);s=throwYut(s,rollBits([false,true,false,false]));const id=s.result!.id;s=useAugment(s,0,'reroll',rollBits([false,true,false,false]));assert.equal(s.throws,0);assert.equal(s.phase,'move');assert.notEqual(s.result!.id,id);assert.equal(s.pendingResults!.length,2);assert.equal(s.lastThrow!.id,3);
});
test('an old saved game without a result queue keeps a rerolled mo while taking its extra throw',()=>{
 const s=ready('o1');delete s.pendingResults;s.players[0].slots=[{id:'reroll',remaining:1}];const out=useAugment(s,0,'reroll',()=>.9);assert.equal(out.phase,'throw');assert.equal(out.pendingResults!.length,1);assert.equal(out.pendingResults![0].name,'모');
});
test('a rerolled do also triggers the once-per-turn do bonus',()=>{
 const s=ready('o1');s.players[0].slots=[{id:'reroll',remaining:1},{id:'do-echo',remaining:-1}];const out=useAugment(s,0,'reroll',rollBits([false,true,false,false]));assert.equal(out.throws,1);assert.equal(out.phase,'throw');assert.equal(out.pendingResults![0].name,'도');
});
