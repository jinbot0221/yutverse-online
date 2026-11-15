import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,throwYut,selectAugment,candidates,useAugment,moveDestination,move,HOME} from './index.ts';
test('the three basic cards recharge one slot and keep offering choices after three selections',()=>{
 let s=createGame(2,true,()=>.5,0);for(let i=0;i<5;i++){s.phase='augment';s.selection={player:0,offers:candidates(s.players[0].slots,()=>.5),queue:[],deadline:60000};assert.equal(s.selection.offers.length,3);s=selectAugment(s,0,'shield',()=>.5,0);}assert.equal(s.players[0].slots.length,1);assert.equal(s.players[0].slots[0].remaining,5);assert.equal(s.choices.length,5);
});
test('back-do protection consumes exactly one chance, keeps saved throws and grants a fair replacement',()=>{
 const s=createGame(2);s.players[0].slots=[{id:'back-guard',remaining:1}];s.pendingResults=[{id:1,name:'윷',steps:4,extra:true,extraSettled:true}];s.lastThrow={id:1,player:0,result:s.pendingResults[0]};let i=0;const n=throwYut(s,()=>[.1,.9,.9,.9][i++%4],0);assert.equal(n.phase,'throw');assert.equal(n.turn,0);assert.equal(n.throws,1);assert.equal(n.lastThrow?.guarded,true);assert.equal(n.players[0].slots[0].remaining,0);assert.deepEqual(n.pendingResults,s.pendingResults);assert.equal(n.players[0].baseTurns,1);
 const next=throwYut(n,()=>.1,0);assert.equal(next.lastThrow?.result.name,'윷');assert.equal(next.lastThrow?.guarded,undefined);assert.equal(next.pendingResults!.length,2);
});
test('one-more-step is manual and single-use, catch protection blocks one capture only',()=>{
 const s=createGame(2);s.phase='move';s.throws=0;s.result={name:'도',steps:1,extra:false};s.players[0].slots=[{id:'boost',remaining:1}];const boosted=useAugment(s,0,'boost');assert.equal(moveDestination(boosted,0)!.node,'o2');assert.equal(boosted.players[0].slots[0].remaining,0);
 s.players[0].pieces[0]={node:'o1',history:[HOME]};s.players[1].pieces[0]={node:'o2',history:[HOME,'o1']};s.players[1].slots=[{id:'shield',remaining:1}];const defended=move(s,0);assert.equal(defended.players[1].pieces[0].node,'o2');assert.equal(defended.players[1].slots[0].remaining,0);
});
