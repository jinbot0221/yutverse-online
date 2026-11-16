import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,candidates,selectAugment,definition,AUGMENTS,REQUESTED_AUGMENTS,ACTIVE_AUGMENT_IDS,type Slot} from './index.ts';
test('normal retains three single-use cards; augment draws the supplied catalogue by stage without duplicates',()=>{
 const seen=new Set<string>();let seed=71;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<1000;i++){const offers=candidates([],rng,'augment',i%2===0?1:6);assert.equal(offers.length,3);assert.equal(new Set(offers).size,3);offers.forEach(id=>seen.add(id));}
 assert.equal(seen.size,REQUESTED_AUGMENTS.length);
 assert.deepEqual(candidates([],rng).sort(),[...ACTIVE_AUGMENT_IDS].sort());
 const s=createGame(2,true,rng,0,[],'augment');assert.equal(s.gameStyle,'augment');const id=s.selection!.offers[0];const next=selectAugment(s,0,id,rng,0);assert.equal(next.players[0].slots.length,1);assert.ok(!candidates(next.players[0].slots,rng,'augment').includes(id));
 next.phase='augment';next.selection={player:0,offers:[id],deadline:1000,queue:[]};assert.equal(selectAugment(next,0,id),next);
});
test('expanded candidates respect spent slots, conflicts and the single hero limit',()=>{
 const slots:Slot[]=[{id:'hero-wind',remaining:-1},{id:'shield',remaining:0},{id:'return',remaining:0}];
 for(let i=0;i<50;i++)for(const id of candidates(slots,Math.random,'augment')){assert.equal(definition(id)!.hero,false);assert.ok(!['shield','return'].includes(id));}
 assert.deepEqual(candidates([...slots,...Array.from({length:7},(_,i)=>({id:`custom-test-${i}` as const,remaining:0}))],Math.random,'augment'),[]);
});

test('start and late augment pools never leak across selection rounds',()=>{for(const round of [1,6,12])for(let n=0;n<200;n++)for(const id of candidates([],Math.random,'augment',round)){const a=REQUESTED_AUGMENTS.find(a=>a.id===id)!;assert.ok(a.stage==='universal'||a.stage===(round===1?'start':'late'));}});
