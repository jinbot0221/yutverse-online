import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,throwYut,move,type State} from '@yutverse/engine';
import {createThrowAnimation} from './throw-motion';
import {createAnimation} from './motion';
test('the confirmed four sticks animate even when the throw immediately opens another choice',()=>{
 const s=createGame(2),after=throwYut(s,()=>.9),plan=createThrowAnimation(s,after,123)!;
 assert.equal(plan.event.result.sticks!.length,4);assert.equal(plan.duration,1100);assert.equal(createThrowAnimation(after,after,0),null);
 const picking:State={...after,phase:'augment'};assert.ok(createThrowAnimation(s,picking,0));
});
test('movement finishing at an augmentation checkpoint remains animated before the selector appears',()=>{
 const s=createGame(2,true);s.phase='move';s.selection=null;s.throws=0;s.result={name:'도',steps:1,extra:false};s.turn=1;s.round=5;s.players[0].baseTurns=1;
 const after=move(s,0);assert.equal(after.phase,'augment');assert.ok(createAnimation(s,after,0));
});
