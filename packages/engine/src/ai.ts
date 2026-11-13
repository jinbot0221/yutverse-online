import {legalMoves,moveDestination,DONE,HOME,type State} from './index.ts';
export type Difficulty='easy'|'normal'|'hard';
export function chooseMove(s:State,difficulty:Difficulty='normal',random:()=>number=Math.random):number {
 const options=legalMoves(s);if(difficulty==='easy')return options[Math.floor(random()*options.length)];
 return [...options].sort((a,b)=>score(s,b,difficulty)-score(s,a,difficulty))[0];
}
function score(s:State,i:number,d:Difficulty):number {
 const p=moveDestination(s,i)!;
 const capture=s.players.flatMap((x,j)=>j===s.turn?[]:x.pieces).filter(x=>x.node===p.node&&p.node!==HOME&&p.node!==DONE).length;
 return (p.node===DONE?100: p.history.length)+capture*25+(d==='hard'?s.players[s.turn].pieces.filter(x=>x.node===p.node&&p.node!==HOME).length*8:0);
}
