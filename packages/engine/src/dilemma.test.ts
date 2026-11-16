import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,useAugment,resolveAbility,DILEMMA_OUTCOMES,dilemmaReward,type DilemmaChoice} from './index.ts';
test('the player-facing payoff table and actual awards agree for all four combinations',()=>{
 assert.deepEqual(DILEMMA_OUTCOMES.map(r=>[r.mineThrows,r.otherThrows]),[[2,2],[0,3],[3,0],[1,1]]);
 for(const row of DILEMMA_OUTCOMES){let s=createGame(3,false,()=>.5,0,[],'augment');s.players[0].slots=[{id:'custom-dilemma',remaining:1}];s=useAugment(s,0,'custom-dilemma',()=>.5,0);s=resolveAbility(s,0,'0',()=>.5,1);s=resolveAbility(s,0,'1',()=>.5,2);assert.deepEqual(s.special!.prompt!.voters,[0,1]);const before=s.throws;s=resolveAbility(s,0,row.mine,()=>.5,3);assert.equal(s.throws,before);assert.ok(s.special?.prompt);s=resolveAbility(s,1,row.other,()=>.5,4);assert.equal(s.throws,before+row.mineThrows);assert.equal(s.players[1].stats!.owedThrows,row.otherThrows);assert.equal(s.players[0].slots[0].remaining,0);assert.ok(s.log.some(line=>line.includes('죄수의 딜레마')));assert.equal(dilemmaReward(row.mine as DilemmaChoice,row.other as DilemmaChoice),row.mineThrows);}
});
