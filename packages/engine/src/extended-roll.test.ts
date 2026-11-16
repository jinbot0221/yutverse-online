import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,throwYut} from './index.ts';
test('all three-, five- and six-stick outcomes use standard names; four or five faces are yut with another throw',()=>{
 for(const [id,count] of [['custom-exchange',3],['custom-burden',5],['custom-excess',6]] as const)for(let mask=0;mask<2**count;mask++){
  const s=createGame(2,false,()=>.5,0,[],'augment');s.players[0].slots=[{id,remaining:-1}];let call=0;
  // customRoll samples the standard roll first, then the chosen stick count.
  const rngWithBase=()=>{if(call++<4)return .9;return mask&(1<<((call-5)%count))?.1:.9;};
  const n=throwYut(s,rngWithBase,0),result=n.lastThrow!.result,heads=Array.from({length:count},(_,i)=>Boolean(mask&(1<<i))).filter(Boolean).length;
  assert.ok(['빽도','도','개','걸','윷','모','탈락'].includes(result.name),`${count}/${mask}: ${result.name}`);assert.equal(result.sticks!.length,count);
  if((heads>=4&&!(count===6&&heads===6))||heads===count&&count===3){assert.equal(result.name,'윷');assert.equal(result.steps,4);assert.equal(result.extra,true);}
 }
});
