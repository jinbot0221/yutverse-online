import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkCustomWins} from './custom.ts';
import {createGame,selectAugment,resolveAbility,move,legalMoves,legalRoutes,throwYut,skipMove,chooseMove,chooseRoute,foldedPosition,foldedPath,sameCell,BOARD_NODES,DONE,type State} from './index.ts';
function movement(s:State,steps=1){s.phase='move';s.turn=0;s.throws=0;s.pendingResults=[];s.result={name:steps<0?'빽도':'도',steps,extra:false};return s;}
for(const fold of ['horizontal','vertical'] as const){
 test(`${fold} folding preserves every logical position and back-do history, including the finish edge`,()=>{
  let s=createGame(3,true,()=>.5,0,[],'augment');s.players[0].pieces[0]={node:'o19',history:['home',...Array.from({length:18},(_,j)=>`o${j+1}`)]};s.players[0].pieces.slice(1).forEach(p=>p.node=DONE);const pieces=structuredClone(s.players.map(p=>p.pieces));s.selection={player:0,offers:['custom-fold'],queue:[],deadline:60000};s=selectAugment(s,0,'custom-fold',()=>.5,0);s=resolveAbility(s,0,fold,()=>.5,1);assert.equal(s.special?.fold,fold);assert.deepEqual(s.players.map(p=>p.pieces),pieces);
  const backward=move(movement(structuredClone(s),-1),0,()=>.5,2);assert.equal(backward.players[0].pieces[0].node,'o18');
  s=move(movement(s),0,()=>.5,2);assert.equal(s.players[0].pieces[0].node,'o20');s=move(movement(s),0,()=>.5,3);assert.equal(s.players[0].pieces[0].node,DONE);assert.ok(s.ranks.includes(0));
 });
 test(`${fold} every route node reaches finish without being remapped backwards`,()=>{
  for(const start of ['home',...BOARD_NODES]){let s=createGame(2,false,()=>.5,0,[],'augment');s.special={fold};s.players[0].pieces[0]={node:start,history:[]};s.players[0].pieces.slice(1).forEach(p=>p.node=DONE);let steps=0;
   while(s.players[0].pieces[0].node!==DONE&&steps++<25){movement(s);const routes=legalRoutes(s,0);const route=routes.find(r=>r.id==='outer')?.id??routes.find(r=>r.id==='homeward')?.id;s=move(s,0,()=>.5,steps,route);}
   assert.equal(s.players[0].pieces[0].node,DONE,`${fold}: ${start}`);
  }
 });
 test(`${fold} fair two-, three- and four-player matches terminate with complete rankings`,()=>{
  for(const count of [2,3,4] as const)for(let seed=1;seed<=8;seed++){let value=seed;const rng=()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296};let s=createGame(count,false,rng,0,[],'augment');s.special={fold};let actions=0;
   while(s.phase!=='over'&&actions++<10000){if(s.phase==='throw')s=throwYut(s,rng,actions);else if(!legalMoves(s).length)s=skipMove(s,rng,actions);else{const piece=chooseMove(s,'hard',rng);s=move(s,piece,rng,actions,chooseRoute(s,piece,'hard',rng));}}
   assert.equal(s.phase,'over',`${fold}: ${count} players seed ${seed}`);assert.equal(new Set(s.ranks).size,count);
  }
 });
}
test('physically overlapping cells catch opponents and stack own pieces while maintaining the arrival route',()=>{
 const s=createGame(3,false,()=>.5,0,[],'augment');s.special={fold:'vertical'};s.players[0].pieces[0]={node:'o1',history:['home']};s.players[0].pieces[1]={node:'o3',history:['home','o1','o2']};s.players[1].pieces[0]={node:'o3',history:['home','o1','o2']};assert.equal(sameCell(s,'o2','o3'),true);const n=move(movement(s),0,()=>.5,0);assert.equal(n.players[1].pieces[0].node,'home');assert.equal(n.players[0].pieces[0].node,'o2');assert.equal(n.players[0].pieces[1].node,'o2');assert.equal(n.throws,1);assert.deepEqual(foldedPosition('o2','vertical'),foldedPosition('o3','vertical'));
});

test('folded perimeter retains both hinge crossings instead of erasing the folded side edges',()=>{const path=['o20',...Array.from({length:20},(_,i)=>`o${i+1}`)];const horizontal=foldedPath(path,'horizontal'),vertical=foldedPath(path,'vertical');for(const x of [-5,5])assert.ok(horizontal.some(([a,b])=>a===x&&b===0));for(const z of [-5,5])assert.ok(vertical.some(([a,b])=>a===0&&b===z));});

test('stack-based victories use the same physical folded cells as capture and rendering',()=>{const s=createGame(2,false,()=>.5,0,[],'augment');s.special={fold:'vertical'};s.players[0].slots=[{id:'custom-connect-four',remaining:-1}];s.players[0].pieces.forEach((piece,i)=>{piece.node=i%2?'o2':'o3';piece.history=['home']});checkCustomWins(s);assert.ok(s.ranks.includes(0));});
