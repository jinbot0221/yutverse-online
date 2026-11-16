import {legalMoves,legalRoutes,sameCell,moveDestination,destination,DONE,HOME,type State,type Piece,type Route} from './index.ts';
export type Difficulty='easy'|'normal'|'hard';
function distance(p:Piece){let piece=p;for(let i=0;i<30;i++){if(piece.node===DONE)return i;piece=destination(piece,1)!;}return 30;}
function score(s:State,index:number,difficulty:Difficulty,route?:Route){
 const p=moveDestination(s,index,route)!;
 const capture=s.players.flatMap((player,j)=>j===s.turn||s.forfeited.includes(j)?[]:player.pieces).filter(x=>sameCell(s,x.node,p.node)&&p.node!==HOME&&p.node!==DONE).length;
 return (p.node===DONE?100:40-distance(p)*2)+capture*25+(difficulty==='hard'?s.players[s.turn].pieces.filter(x=>sameCell(s,x.node,p.node)&&p.node!==HOME).length*8:0);
}
export function chooseRoute(s:State,index:number,difficulty:Difficulty='normal',random:()=>number=Math.random):Route|undefined{
 const routes=legalRoutes(s,index);if(!routes.length)return undefined;
 if(difficulty==='easy')return routes[Math.floor(random()*routes.length)].id;
 return [...routes].sort((a,b)=>score(s,index,difficulty,b.id)-score(s,index,difficulty,a.id))[0].id;
}
export function chooseMove(s:State,difficulty:Difficulty='normal',random:()=>number=Math.random):number{
 const options=legalMoves(s);if(difficulty==='easy')return options[Math.floor(random()*options.length)];
 return [...options].sort((a,b)=>score(s,b,difficulty,chooseRoute(s,b,difficulty))-score(s,a,difficulty,chooseRoute(s,a,difficulty)))[0];
}
