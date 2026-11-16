import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,selectAugment,resolveAbility,canUseAugment,useAugment,throwYut,move,activateNative,REQUESTED_AUGMENTS,definition,forfeit,placement,type State,type AugmentId} from './index.ts';
import {killSpecial,winSpecial,customTurn,checkCustomWins} from './custom.ts';
const rng=(()=>{let seed=823;return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}})();
function base(){const s=createGame(4,false,rng,0,[],'augment');s.round=6;s.players[0].pieces=[...Array.from({length:3},()=>({node:'o1',history:['home']})),{node:'o4',history:['home','o1','o2','o3']},{node:'home',history:[]}];s.players[1].pieces[0]={node:'o2',history:['home','o1']};s.players[2].pieces[0]={node:'c',history:[]};return s;}
function give(s:State,key:string){const id=`custom-${key}` as AugmentId;s.players[0].slots.push({id,remaining:definition(id)!.charges});return id;}
function resolve(s:State,prefer?:string){let count=0;while(s.special?.prompt){assert.ok(count++<30,'interaction must terminate');const q=s.special.prompt,actor=(q.voters||[q.owner]).find(i=>!Object.hasOwn(q.answers||{},i))!,value=q.options.find(o=>o.value===prefer)?.value||q.options[0].value;s=resolveAbility(s,actor,value,rng,q.deadline-1);}return s;}
test('all 92 supplied cards have unique names, correct stages and resolvable acquisition/usage',()=>{
 assert.equal(REQUESTED_AUGMENTS.length,92);assert.equal(new Set(REQUESTED_AUGMENTS.map(a=>a.id)).size,92);assert.equal(REQUESTED_AUGMENTS.filter(a=>a.stage==='start').length,14);assert.equal(REQUESTED_AUGMENTS.filter(a=>a.stage==='late').length,21);
 for(const a of REQUESTED_AUGMENTS){let s=base();s.round=a.stage==='late'?6:1;s.phase='augment';s.selection={player:0,offers:[a.id as AugmentId],queue:[],deadline:60000};s=resolve(selectAugment(s,0,a.id,rng,0));assert.ok(s.choices.some(c=>c.id===a.id),a.name);
 if(a.manual){s=base();const id=give(s,a.id.slice(7));s.phase='throw';if(a.id==='custom-flip'){s.phase='move';s.throws=0;s.result={id:1,name:'도',steps:1,extra:false,sticks:[false,true,false,false]};s.pendingResults=[s.result];}if(a.id==='custom-necromancer')s.forfeited=[3];if(a.id==='custom-cancel-wins')s.ranks=[2];assert.equal(canUseAugment(s,0,id),true,a.name);const after=resolve(useAugment(s,0,id,rng,0));assert.notEqual(after,s,a.name);s=after;}
 for(const p of s.players)for(const piece of p.pieces){assert.ok(Number.isFinite(piece.history.length),a.name);assert.ok(piece.node==='home'||piece.node==='done'||/^(o\d+|[abde][12]|c)$/.test(piece.node),`${a.name}: ${piece.node}`);}
 }
});
test('special tokens preserve kind, protection and bombs through normal movement',()=>{
 const s=base();s.phase='move';s.throws=0;s.result={name:'도',steps:1,extra:false};s.players[0].pieces[0]={node:'o4',history:['home','o1','o2','o3'],kind:'pelican',shield:1,bomb:{owner:0,round:12}};const n=move(s,0,rng,0);assert.equal(n.players[0].pieces[0].kind,'pelican');assert.equal(n.players[0].pieces[0].shield,1);assert.equal(n.players[0].pieces[0].bomb?.round,12);
});
test('dogs grants three actual moves; a fourth use is rejected',()=>{let s=base();const id=give(s,'dogs');for(let i=0;i<3;i++)s=useAugment(s,0,id,rng,0);assert.equal(s.pendingResults!.filter(r=>r.name==='개').length,3);assert.equal(useAugment(s,0,id),s);});
test('six fair sticks, conditional no-drop, forced result and one-back-face obey their modifiers',()=>{
 let s=base();give(s,'excess');let n=throwYut(s,()=>.1,0);assert.ok(n.forfeited.includes(0));s=base();give(s,'excess');give(s,'no-drop');n=throwYut(s,()=>.1,0);assert.equal(n.forfeited.includes(0),false);assert.equal(n.lastThrow!.result.sticks!.length,6);
 s=base();const force=give(s,'quick-hands');s=resolve(useAugment(s,0,force,rng,0),'5');n=throwYut(s,()=>.9,0);assert.equal(n.lastThrow!.result.name,'모');assert.equal(s.players[0].slots[0].remaining,0);
});
test('a bomb transfers to the captured token and explodes on the receiving player at its deadline',()=>{
 const s=base();s.phase='move';s.throws=0;s.result={name:'도',steps:1,extra:false};s.players[0].pieces[0].bomb={owner:0,round:7};const n=move(s,0,rng,0);assert.equal(n.players[0].pieces[0].bomb,undefined);assert.equal(n.players[1].pieces[0].bomb?.round,7);n.round=7;customTurn(n,0,true,rng);assert.ok(n.forfeited.includes(1));
});
test('peace and group shields protect against abilities, while friend shield limits a normal capture',()=>{const s=base();s.players[1].slots=[{id:'custom-peace',remaining:-1}];assert.equal(killSpecial(s,0,1,0),false);s.players[1].slots=[];s.players[1].pieces[0].shield=1;assert.equal(killSpecial(s,0,1,0),false);assert.equal(killSpecial(s,0,1,0),true);
 const n=base();n.phase='move';n.throws=0;n.result={name:'도',steps:1,extra:false};n.players[1].slots=[{id:'custom-friend-shield',remaining:-1}];n.players[1].pieces[1]={node:'o2',history:['home','o1']};const out=move(n,0,rng,0);assert.equal(out.players[1].pieces.filter(p=>p.node==='home').length,3);assert.equal(out.players[1].pieces.filter(p=>p.node==='o2').length,1);
});
test('linked victory and defeat preserve identical placements',()=>{let s=base();s.special={linked:{1:0}};winSpecial(s,0);assert.equal(placement(s,0),1);assert.equal(placement(s,1),1);s=forfeit(s,3,rng,0);assert.equal(s.phase,'over');assert.equal(placement(s,2),3);
});
test('native goblin and cannon moves are once per base turn',()=>{let s=base();s.phase='move';s.throws=0;s.result={name:'도',steps:1,extra:false};s.players[0].pieces[0].kind='goblin';s=activateNative(s,0,0,0);assert.ok(s.special?.prompt);s=resolve(s,'forward');assert.equal(s.players[0].pieces[0].node,'o2');assert.equal(activateNative(s,0,0,0),s);});
test('cat compulsion cannot be evaded by choosing another offer or rerolling',()=>{const s=createGame(3,true,rng,0,[],'augment');s.special={catForced:true};s.selection!.offers=['custom-cat','custom-dogs','custom-moonwalk'];assert.equal(selectAugment(s,0,'custom-dogs',rng,0),s);});
test('special victory counters use actual capture and completion states',()=>{const s=base();give(s,'coup');for(let j=0;j<4;j++){s.players[1].pieces[j]={node:'o2',history:[]};killSpecial(s,0,1,j);}assert.ok(s.ranks.includes(0));const n=base();give(n,'star');n.players[0].pieces=Array.from({length:8},()=>({node:'o1',history:['home'],kind:'star',strength:1}));checkCustomWins(n);assert.ok(n.ranks.includes(0));});

test('a skipped first player never loses the global round-six selection checkpoint',()=>{let s=createGame(3,false,rng,0);s.augmented=true;s.round=5;s.turn=2;s.phase='move';s.throws=0;s.result={name:'도',steps:1,extra:false};s.players[0].stats={skip:1};s=move(s,0,rng,0);assert.equal(s.round,6);const selected=[];while(s.selection){selected.push(s.selection.player);s=selectAugment(s,s.selection.player,s.selection.offers[0],rng,0);}assert.deepEqual(selected,[0,1,2]);assert.equal(s.turn,1);assert.equal(s.round,6);});
test('leech bonds block independent finishes and propagate transitive losses on resignation',()=>{let s=base();s.special={linked:{1:0,2:1},linkedOnly:[1,2]};s.players[1].pieces.forEach(p=>p.node='done');checkCustomWins(s);assert.equal(s.ranks.includes(1),false);s=forfeit(s,0,rng,0);assert.equal(s.phase,'over');assert.equal(placement(s,0),placement(s,1));assert.equal(placement(s,1),placement(s,2));assert.equal(placement(s,3),1);});

test('an elimination during a hidden throw cannot leave an unanswerable end-game prompt',()=>{const s=createGame(2,false,rng,0,[],'augment');give(s,'excess');s.players[0].stats={bluffReady:1,bluff:5};const n=throwYut(s,()=>.1,0);assert.equal(n.phase,'over');assert.equal(n.special?.prompt,undefined);});
