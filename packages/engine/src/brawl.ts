import type {State} from './index.ts';
import {foldedPosition,cellKey} from './fold.ts';
import {recordTargetEffect} from './target-effects.ts';
import {active,nodes,killSpecial,syncRiders} from './custom.ts';
export const BRAWL_ID='custom-brawl';
export type BrawlBody={key:string;player:number;indices:number[];origin:string;x:number;y:number;radius:number;mass:number;out:boolean};
export type BrawlFrame={bodies:{key:string;x:number;y:number;out:boolean}[]};
export type BrawlState={owner:number;order:number[];cursor:number;bodies:BrawlBody[];bounds:{left:number;right:number;top:number;bottom:number};finished?:boolean;lastShot?:{serial:number;actor:number;at:number;frames:BrawlFrame[];summary:string}};
/** Fixed-step deterministic physics. The server runs the same pure solver as offline play. */
export function simulateBrawl(input:BrawlBody[],key:string,angle:number,power:number,bounds:BrawlState['bounds']){
 const bodies=input.map(b=>({...b,indices:[...b.indices],vx:0,vy:0}));const selected=bodies.find(b=>b.key===key&&!b.out)!;
 const speed=(4+power*.13)/Math.pow(selected.mass,.35),radians=angle*Math.PI/180;selected.vx=Math.cos(radians)*speed;selected.vy=Math.sin(radians)*speed;
 const frames:BrawlFrame[]=[],frame=()=>frames.push({bodies:bodies.map(({key,x,y,out})=>({key,x:Math.round(x*10000)/10000||0,y:Math.round(y*10000)/10000||0,out}))});frame();
 for(let step=0;step<300;step++){
  for(const b of bodies)if(!b.out){b.x+=b.vx/60;b.y+=b.vy/60;b.vx*=.978;b.vy*=.978;if(b.x<bounds.left||b.x>bounds.right||b.y<bounds.top||b.y>bounds.bottom){b.out=true;b.vx=0;b.vy=0;}}
  for(let a=0;a<bodies.length;a++)for(let c=a+1;c<bodies.length;c++){
   const u=bodies[a],v=bodies[c];if(u.out||v.out)continue;const dx=v.x-u.x,dy=v.y-u.y,distance=Math.hypot(dx,dy),radius=u.radius+v.radius;if(distance>=radius)continue;
   const nx=distance>1e-8?dx/distance:1,ny=distance>1e-8?dy/distance:0,invU=1/u.mass,invV=1/v.mass,overlap=(radius-distance+.001)/(invU+invV);
   u.x-=nx*overlap*invU;u.y-=ny*overlap*invU;v.x+=nx*overlap*invV;v.y+=ny*overlap*invV;
   const relative=(v.vx-u.vx)*nx+(v.vy-u.vy)*ny;if(relative<0){const impulse=-(1+.86)*relative/(invU+invV);u.vx-=impulse*nx*invU;u.vy-=impulse*ny*invU;v.vx+=impulse*nx*invV;v.vy+=impulse*ny*invV;}
  }
  if(step%10===9)frame();if(step>30&&bodies.every(b=>b.out||Math.hypot(b.vx,b.vy)<.04))break;
 }
 for(const b of bodies)if(!b.out&&(b.x<bounds.left||b.x>bounds.right||b.y<bounds.top||b.y>bounds.bottom))b.out=true;
 frame();return {bodies:bodies.map(({vx,vy,...b})=>b),frames};
}
function log(s:State,text:string){s.log=[text,...s.log].slice(0,12);}
function available(s:State,b:BrawlBody){return !b.out&&active(s,b.player)&&b.indices.some(i=>nodes.includes(s.players[b.player].pieces[i]?.node));}
function autoShot(s:State,b:BrawlState,actor:number){const mine=b.bodies.find(t=>t.player===actor&&available(s,t))!;const target=b.bodies.filter(t=>t.player!==actor&&available(s,t)).sort((a,c)=>Math.hypot(a.x-mine.x,a.y-mine.y)-Math.hypot(c.x-mine.x,c.y-mine.y))[0];const angle=target?(Math.round(Math.atan2(target.y-mine.y,target.x-mine.x)*180/Math.PI)+360)%360:0;return `${mine.key}:${angle}:65`;}
export function advanceBrawl(s:State,now:number){
 const b=s.special?.brawl;if(!b)return;
 for(const body of b.bodies)if(!available(s,body))body.out=true;
 while(b.cursor<b.order.length){const actor=b.order[b.cursor];if(active(s,actor)&&b.bodies.some(t=>t.player===actor&&available(s,t)))break;log(s,`${s.players[actor].name}: 판 위의 대난투 · 칠 말이 없어 기회를 넘깁니다.`);b.cursor++;}
 if(b.cursor>=b.order.length){b.finished=true;const owner=s.players.findIndex((_,i)=>active(s,i));if(owner<0){delete s.special!.brawl;delete s.special!.prompt;return;}s.special!.prompt={id:BRAWL_ID,owner,title:'대난투 종료 · 윷놀이로 돌아갑니다',options:[{value:'continue',label:'윷놀이 재개'}],deadline:now+2000};return;}
 const actor=b.order[b.cursor];s.special!.prompt={id:BRAWL_ID,owner:actor,title:`판 위의 대난투 · ${s.players[actor].name}님의 한 번 치기`,options:[{value:autoShot(s,b,actor),label:'가까운 상대를 향해 자동 치기'}],deadline:now+60000};
}
export function beginBrawl(s:State,owner:number,now:number){
 const groups=new Map<string,BrawlBody>();for(let player=0;player<s.players.length;player++)if(active(s,player))s.players[player].pieces.forEach((p,index)=>{if(!nodes.includes(p.node)||p.swallowedBy)return;const key=`${player}:${cellKey(s,p.node)}`,existing=groups.get(key);if(existing){existing.indices.push(index);existing.mass++;existing.radius=Math.min(.82,.52+.08*(existing.mass-1));}else{const [x,y]=foldedPosition(p.node,s.special?.fold);groups.set(key,{key:`${player}-${index}`,player,indices:[index],origin:p.node,x,y,radius:.52,mass:1,out:false});}});
 const bodies=[...groups.values()];if(!bodies.length){log(s,'판 위의 대난투: 판 위에 말이 없어 바로 윷놀이를 이어갑니다.');return;}
 const fold=s.special?.fold,bounds={left:-5.9,right:fold==='vertical'?0:5.9,top:-5.9,bottom:fold==='horizontal'?0:5.9};
 for(let i=0;i<bodies.length;i++){const group=bodies.filter(t=>t.x===bodies[i].x&&t.y===bodies[i].y);if(group.length>1)for(let n=0;n<group.length;n++){group[n].x=Math.max(bounds.left+.55,Math.min(bounds.right-.55,group[n].x+Math.cos(2*Math.PI*n/group.length)*.6));group[n].y=Math.max(bounds.top+.55,Math.min(bounds.bottom-.55,group[n].y+Math.sin(2*Math.PI*n/group.length)*.6));}}
 (s.special??={}).brawl={owner,order:s.players.map((_,j)=>(owner+j)%s.players.length).filter(i=>active(s,i)),cursor:0,bodies,bounds};log(s,`${s.players[owner].name}: 판 위의 대난투! 플레이어마다 한 번씩 칩니다.`);advanceBrawl(s,now);
}
export function resolveBrawl(s:State,actor:number,value:string,now:number){
 const b=s.special?.brawl,q=s.special?.prompt;if(!b||q?.id!==BRAWL_ID||q.owner!==actor||now>=q.deadline||!active(s,actor))return false;
 if(b.finished){if(value!=='continue')return false;delete s.special!.prompt;delete s.special!.brawl;log(s,'판 위의 대난투 종료 · 살아남은 말은 원래 칸에서 윷놀이를 이어갑니다.');return true;}
 if(b.lastShot&&now<b.lastShot.at+1400)return false;
 const match=/^(\d+-\d+):(\d{1,3}):(\d{1,3})$/.exec(value);if(!match)return false;
 const [,key,angleText,powerText]=match,angle=Number(angleText),power=Number(powerText),body=b.bodies.find(t=>t.key===key&&t.player===actor&&available(s,t));if(!body||angle>359||power<1||power>100)return false;
 const result=simulateBrawl(b.bodies,key,angle,power,b.bounds);let captured=0,defended=0;const previousMove=s.lastMove;delete s.lastMove;
 for(const hit of result.bodies)if(hit.out&&!b.bodies.find(t=>t.key===hit.key)!.out){const survivors:number[]=[];let hits=0;for(const index of hit.indices){if(!active(s,hit.player))break;const killed=killSpecial(s,actor,hit.player,index);if(killed){captured++;hits++;}else if(nodes.includes(s.players[hit.player].pieces[index]?.node))survivors.push(index);}
  recordTargetEffect(s,actor,hit.player,BRAWL_ID,`판 위의 대난투 · 판 밖 밀기 · 잡힌 말 ${hits}개`);
  if(survivors.length&&active(s,hit.player)){hit.indices=survivors;hit.mass=survivors.length;hit.radius=Math.min(.82,.52+.08*(survivors.length-1));hit.out=false;hit.x=Math.max(b.bounds.left+.6,Math.min(b.bounds.right-.6,hit.x));hit.y=Math.max(b.bounds.top+.6,Math.min(b.bounds.bottom-.6,hit.y));defended++;}
 }
 s.lastMove=previousMove;b.bodies=result.bodies;syncRiders(s);const summary=`${s.players[actor].name}: 한 번 치기 · 잡힌 말 ${captured}개${defended?` · 방어한 말뭉치 ${defended}개`:''}`;
 b.lastShot={serial:(b.lastShot?.serial||0)+1,actor,at:now,frames:result.frames,summary};log(s,summary);b.cursor++;advanceBrawl(s,now);return true;
}
