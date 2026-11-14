import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,roll,destination,throwYut,move,chooseMove,DONE,HOME,type State} from './index.ts';
test('16 equally likely stick combinations include back-do and extra throws',()=>{const counts:Record<string,number>={};for(let mask=0;mask<16;mask++){let i=0;const r=roll(()=>mask&(1<<i++)?.1:.9);counts[r.name]=(counts[r.name]||0)+1;assert.equal(r.extra,['윷','모'].includes(r.name));}assert.deepEqual(counts,{'모':1,'빽도':1,'도':3,'개':6,'걸':4,'윷':1});});
test('outer circuit requires passing the starting point to finish',()=>{let p={node:HOME,history:[] as string[]};p=destination(p,20)!;assert.equal(p.node,'o20');assert.equal(destination(p,1)!.node,DONE);});
test('shortcuts only start on a corner; both diagonals exit correctly',()=>{assert.equal(destination({node:'o4',history:[]},2)!.node,'o6');assert.equal(destination({node:'o5',history:[]},3)!.node,'c');assert.equal(destination({node:'o5',history:[]},6)!.node,'o20');assert.equal(destination({node:'o10',history:[]},6)!.node,'o15');});
test('back-do retraces route and is unavailable at home',()=>{const p=destination({node:'o5',history:['o4']},2)!;assert.equal(destination(p,-1)!.node,'a1');assert.equal(destination({node:HOME,history:[]},-1),null);});
function moving():State{const s=createGame();s.phase='move';s.result={name:'도',steps:1,extra:false};s.throws=0;return s;}
test('stack moves together and captures an opposing stack with one extra throw',()=>{const s=moving();s.players[0].pieces[0]={node:'o1',history:[HOME]};s.players[0].pieces[1]={node:'o1',history:[HOME]};s.players[1].pieces[0]={node:'o2',history:[HOME,'o1']};const out=move(s,0);assert.equal(out.players[0].pieces[1].node,'o2');assert.equal(out.players[1].pieces[0].node,HOME);assert.equal(out.phase,'throw');assert.equal(out.turn,0);assert.equal(s.players[1].pieces[0].node,'o2');});
test('first finisher does not end a three-player match',()=>{const s=moving();s.players[0].pieces=Array.from({length:4},()=>({node:'o20',history:['o19']}));const out=move(s,0);assert.deepEqual(out.ranks,[0]);assert.notEqual(out.phase,'over');assert.equal(out.turn,1);});
test('seeded AI matches complete all rankings without deadlocks',()=>{for(let seed=1;seed<=20;seed++){let rng=seed;const random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296};let s=createGame();let actions=0;while(s.phase!=='over'&&actions++<20000)s=s.phase==='throw'?throwYut(s,random):move(s,chooseMove(s,'hard',random));assert.equal(s.phase,'over');assert.equal(new Set(s.ranks).size,3);assert.ok(s.players[s.ranks[0]].pieces.every(p=>p.node===DONE));}});
test('two players: first finisher or forfeit determines both ranks',async()=>{
 const {forfeit}=await import('./index.ts');
 const s=createGame(2);s.phase='move';s.result={name:'도',steps:1,extra:false};s.throws=0;
 s.players[0].pieces=s.players[0].pieces.map(()=>({node:'o20',history:[]}));
 const out=move(s,0);assert.equal(out.phase,'over');assert.deepEqual(out.ranks,[0,1]);
 assert.deepEqual(forfeit(createGame(2),0).ranks,[1,0]);
});
test('move events retain the full shortcut path and captured stack without changing old state',()=>{
 const s=createGame(2);s.phase='move';s.result={name:'걸',steps:3,extra:false};s.throws=0;
 s.players[0].pieces[0]={node:'o5',history:['home','o1','o2','o3','o4']};
 s.players[1].pieces[0]={node:'c',history:[]};s.players[1].pieces[1]={node:'c',history:[]};
 const out=move(s,0);assert.deepEqual(out.lastMove?.path,['o5','a1','a2','c']);
 assert.deepEqual(out.lastMove?.captures,[{player:1,indices:[0,1],from:'c',to:'home'}]);
 assert.equal(out.lastMove?.id,1);assert.equal(s.lastMove,undefined);
});
test('back-do event retraces its prior node; blocked capture does not animate a capture',()=>{
 const s=createGame(2);s.phase='move';s.result={name:'빽도',steps:-1,extra:false};s.throws=0;
 s.players[0].pieces[0]={node:'a2',history:['home','o5','a1']};s.players[1].pieces[0]={node:'a1',history:[]};s.players[1].slots=[{id:'shield',remaining:1}];
 const out=move(s,0);assert.deepEqual(out.lastMove?.path,['a2','a1']);assert.deepEqual(out.lastMove?.captures,[]);
});
