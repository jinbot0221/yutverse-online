import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS,character,createGame,move,throwYut,HOME} from './index.ts';

test('selected heroes survive throws, stacked moves and captures without changing the rules',()=>{
 const random=()=>.2;
 const a=createGame(2,false,random,0,['archer','mage']),b=createGame(2,false,random,0,['dwarf','fighter']);
 assert.deepEqual(throwYut(a,random,0).lastThrow?.result,throwYut(b,random,0).lastThrow?.result);
 a.phase='move';a.result={name:'도',steps:1,extra:false};a.throws=0;
 a.players[0].pieces[0]={node:'o2',history:[HOME,'o1']};a.players[0].pieces[1]=structuredClone(a.players[0].pieces[0]);a.players[1].pieces[0]={node:'o3',history:[HOME,'o1','o2']};
 const next=move(a,0,random,0);assert.deepEqual(next.players.map(p=>p.character),['archer','mage']);assert.equal(next.players[0].pieces[1].node,'o3');assert.equal(next.players[1].pieces[0].node,HOME);
});
test('old saved games with no hero still resolve to a playable default; all available heroes are distinct',()=>{
 assert.equal(character(undefined).id,'otter');assert.equal(character('old-unavailable-hero').id,'otter');assert.equal(new Set(CHARACTERS.map(c=>c.id)).size,4);
 const legacy=createGame(2);delete legacy.players[0].character;assert.notEqual(throwYut(legacy,()=>.7),legacy);
});
