import {HOME,DONE,position,type State,type MoveEvent} from '@yutverse/engine';
export type AnimationPlan={before:State;event:MoveEvent;start:number;travelMs:number;captureMs:number;duration:number;reduced:boolean};
export type MotionToken={player:number;index:number;x:number;z:number};
export type Pose={x:number;y:number;z:number;scale:number;turn:number;roll:number;kind:'idle'|'move'|'capture'|'finish'};
export function homePosition(player:number,index:number):[number,number]{const along=-3.45+index*2.3;return player===0?[along,7.3]:player===1?[-7.3,along]:player===2?[along,-7.3]:[7.3,along];}
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function createAnimation(before:State|undefined,after:State|undefined,start:number,reduced=false):AnimationPlan|null{
 const event=after?.lastMove;
 if(!before||!after||!event||before.players.length!==after.players.length||event.id!==(before.lastMove?.id||0)+1)return null;
 const travelMs=reduced?120:Math.max(1,event.path.length-1)*180;
 const captureMs=event.captures.length?(reduced?120:850):0;
 return {before,event,start,travelMs,captureMs,duration:travelMs+Math.max(captureMs,event.path.at(-1)===DONE?(reduced?120:450):120),reduced};
}
export function samplePose(token:MotionToken,plan:AnimationPlan|null,elapsed:number):Pose{
 const base:Pose={x:token.x,y:.16,z:token.z,scale:1,turn:0,roll:0,kind:'idle'};if(!plan)return base;
 const {event,travelMs,captureMs,reduced}=plan;
 if(event.player===token.player&&event.indices.includes(token.index)){
  const points=event.path.map((node,i)=>i===0?[token.x,token.z]:node===HOME?homePosition(token.player,token.index):position(node));
  const progress=clamp(elapsed/travelMs)*(points.length-1),segment=Math.min(points.length-2,Math.floor(progress)),fraction=progress-segment;
  const a=points[Math.max(0,segment)],b=points[Math.max(1,segment+1)];
  const ended=elapsed>=travelMs,finishing=event.path.at(-1)===DONE&&ended;
  return {...base,x:a[0]+(b[0]-a[0])*fraction,z:a[1]+(b[1]-a[1])*fraction,y:.16+(reduced?0:Math.sin(fraction*Math.PI)*.42)+(finishing?(elapsed-travelMs)/450*1.8:0),scale:finishing?1-clamp((elapsed-travelMs)/(reduced?120:450)):1,turn:ended?0:Math.atan2(b[0]-a[0],b[1]-a[1]),kind:finishing?'finish':'move'};
 }
 const captured=event.captures.find(c=>c.player===token.player&&c.indices.includes(token.index));
 if(captured&&elapsed>=travelMs){
  const t=clamp((elapsed-travelMs)/captureMs),end=captured.to===HOME?homePosition(token.player,token.index):position(captured.to);
  return {...base,x:token.x+(end[0]-token.x)*t,z:token.z+(end[1]-token.z)*t,y:.16+(reduced?0:Math.sin(t*Math.PI)*2),scale:reduced?1:1-Math.sin(t*Math.PI)*.35,turn:reduced?0:t*Math.PI*6,roll:reduced?0:Math.sin(t*Math.PI*6)*.25,kind:'capture'};
 }
 return base;
}
