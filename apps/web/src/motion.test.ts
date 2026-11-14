import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,move,position,type State} from '@yutverse/engine';
import {createAnimation,samplePose,homePosition} from './motion';
function ready(steps:number):State{const s=createGame(2);s.phase='move';s.result={name:'걸',steps,extra:false};s.throws=0;return s;}
test('animation follows shortcut waypoints and capture starts only after landing',()=>{
 const before=ready(3);before.players[0].pieces[0]={node:'o5',history:['home','o1','o2','o3','o4']};before.players[1].pieces[0]={node:'c',history:[]};
 const after=move(before,0),plan=createAnimation(before,after,100)!;
 const mover={player:0,index:0,x:-5,z:5},victim={player:1,index:0,x:0,z:0};
 assert.deepEqual([samplePose(mover,plan,180).x,samplePose(mover,plan,180).z],position('a1'));
 assert.equal(samplePose(victim,plan,plan.travelMs-1).kind,'idle');
 const mid=samplePose(victim,plan,plan.travelMs+plan.captureMs/2);assert.equal(mid.kind,'capture');assert.ok(mid.y>1);
 const end=samplePose(victim,plan,plan.travelMs+plan.captureMs);assert.deepEqual([end.x,end.z],homePosition(1,0));
 assert.equal(after.players[1].pieces[0].node,'home');assert.equal(before.players[1].pieces[0].node,'c');
});
test('mount/reconnect and skipped event revisions do not replay stale animations',()=>{
 const s=ready(1),after=move(s,0);assert.equal(createAnimation(after,after,0),null);assert.equal(createAnimation(undefined,after,0),null);
 const jumped=structuredClone(after);jumped.lastMove!.id=5;assert.equal(createAnimation(s,jumped,0),null);
 const picking=structuredClone(after);picking.phase='augment';assert.ok(createAnimation(s,picking,0),'finish movement before showing the next choice screen');
});
test('reduced-motion capture retains positions and timing without bouncing or spinning',()=>{
 const before=ready(1);before.players[1].pieces[0]={node:'o1',history:[]};const plan=createAnimation(before,move(before,0),0,true)!;
 const pose=samplePose({player:1,index:0,x:3,z:5},plan,plan.travelMs+plan.captureMs/2);assert.equal(pose.y,.16);assert.equal(pose.turn,0);assert.equal(pose.roll,0);assert.ok(plan.duration<500);
});
test('finishing shrinks a token only after it traverses the final segment',()=>{
 const before=ready(1);before.players[0].pieces[0]={node:'o20',history:[]};const plan=createAnimation(before,move(before,0),0)!;
 const token={player:0,index:0,x:5,z:5};assert.equal(samplePose(token,plan,0).scale,1);assert.equal(samplePose(token,plan,plan.duration).scale,0);
});
