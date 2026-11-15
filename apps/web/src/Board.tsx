import {useEffect,useRef,useState} from 'react';
import {Canvas,useThree,useFrame} from '@react-three/fiber';
import {OrbitControls,Line} from '@react-three/drei';
import {OrthographicCamera,Vector3,type Group,type MeshBasicMaterial} from 'three';
import {legalMoves,position,HOME,DONE,character,type State} from '@yutverse/engine';
import {ThrowSticks} from './ThrowSticks';
import {CharacterSprite} from './CharacterSprite';
import type {ThrowAnimation} from './throw-motion';
import {homePosition,samplePose,type AnimationPlan} from './motion';

const colors=['#ffbe32','#48dfb0','#69a9ff','#ff79c6'];
const nodes=[...Array.from({length:20},(_,i)=>`o${i+1}`),'a1','a2','b1','b2','c','d1','d2','e1','e2'];

function PlaybackClock<T extends AnimationPlan|ThrowAnimation>({plan,onEnd}:{plan:T|null;onEnd:(plan:T)=>void}){
 const previous=useRef<AnimationPlan|ThrowAnimation|null>(null),warmFrames=useRef(0);
 useFrame(()=>{
  if(!plan)return;
  if(previous.current!==plan){previous.current=plan;warmFrames.current=0;}
  if(!Number.isFinite(plan.start)){if(warmFrames.current++===0)return;plan.start=performance.now();}
  if(performance.now()-plan.start>=plan.duration)onEnd(plan);
 },-10);
 return null;
}

function FitCamera(){
 const {camera,size,gl}=useThree(),[dockHeight,setDockHeight]=useState(200);
 useEffect(()=>{
  const dock=gl.domElement.closest('.game-shell')?.querySelector('.layout aside');if(!dock)return;
  const update=()=>setDockHeight(Math.ceil(dock.getBoundingClientRect().height)+(parseFloat(getComputedStyle(dock).bottom)||0)+8);
  update();const observer=new ResizeObserver(update);observer.observe(dock);return()=>observer.disconnect();
 },[gl,size.width,size.height]);
 useEffect(()=>{
  if(!(camera instanceof OrthographicCamera))return;
  const portrait=size.width<=760&&size.height>=size.width;
  const compact=size.height<=500&&!portrait;
  const side=portrait?0:compact?250:334;
  const top=portrait?145:compact?70:110;
  const bottom=portrait?dockHeight:80;
  camera.zoom=Math.max(portrait?3:8,Math.min((size.width-side-28)/17.7,(size.height-top-bottom)/16.5));
  camera.setViewOffset(size.width,size.height,side/2,(bottom-top)/2,size.width,size.height);
  camera.updateProjectionMatrix();
 },[camera,size.width,size.height,dockHeight]);
 return null;
}

function Token({x,z,color,selectable,onClick,player,index,animation,characterId}:{x:number;z:number;color:string;selectable:boolean;onClick:()=>void;player:number;index:number;animation:AnimationPlan|null;characterId?:string}){
 const group=useRef<Group>(null);
 useFrame(()=>{if(!group.current)return;const pose=samplePose({x,z,player,index},animation,animation?performance.now()-animation.start:0);group.current.position.set(pose.x,pose.y,pose.z);group.current.rotation.set(0,pose.turn,pose.roll);group.current.scale.setScalar(1.18*pose.scale)});
 return <group ref={group} position={[x,.16,z]} scale={1.18} onClick={e=>{e.stopPropagation();if(selectable)onClick()}} onPointerOver={()=>{if(selectable)document.body.style.cursor='pointer'}} onPointerOut={()=>{document.body.style.cursor=''}}>
  <mesh position={[0,-.055,0]}><cylinderGeometry args={[.68,.74,.12,24]}/><meshStandardMaterial color="#102c36"/></mesh>
  <mesh><cylinderGeometry args={[.6,.64,.17,24]}/><meshStandardMaterial color={color} roughness={.45}/></mesh>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,.1,0]}><ringGeometry args={[.49,.57,32]}/><meshBasicMaterial color="white"/></mesh>
  <CharacterSprite id={characterId} token={{x,z,player,index}} animation={animation}/>
  {selectable&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.1,0]}><ringGeometry args={[.77,.91,40]}/><meshBasicMaterial color="#fff4a5" toneMapped={false}/></mesh>}

 </group>;
}

type VisibleToken={key:string;player:number;index:number;x:number;z:number;color:string;label:string;selectable:boolean;stack:number;characterId?:string};
function ProjectLabels({tokens,elements,animation}:{tokens:VisibleToken[];elements:Map<string,HTMLDivElement>;animation:AnimationPlan|null}){
 const point=useRef(new Vector3());
 useFrame(({camera,size})=>{
  for(const token of tokens){
   const element=elements.get(token.key);if(!element)continue;
   const pose=samplePose(token,animation,animation?performance.now()-animation.start:0);
   point.current.set(pose.x,pose.y-.16+3.7*pose.scale,pose.z).project(camera);element.dataset.motion=pose.kind;
   const x=(point.current.x+1)*size.width/2,y=(1-point.current.y)*size.height/2;
   element.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
   element.style.visibility=pose.scale<.05||point.current.z<-1||point.current.z>1?'hidden':'visible';
  }
 });return null;
}

function CaptureBurst({animation}:{animation:AnimationPlan}){
 const group=useRef<Group>(null),material=useRef<MeshBasicMaterial>(null);
 const [x,z]=position(animation.event.captures[0].from);
 useFrame(()=>{const t=(performance.now()-animation.start-animation.travelMs)/animation.captureMs;if(group.current){group.current.visible=t>=0&&t<=1;group.current.scale.setScalar(1+Math.max(0,t)*2.5);}if(material.current)material.current.opacity=Math.max(0,Math.min(1,1-t))*.8});
 return <group ref={group} position={[x,.24,z]} visible={false}><mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.5,.7,36]}/><meshBasicMaterial ref={material} color="#ffb14e" transparent opacity={0} toneMapped={false}/></mesh></group>;
}

export function Board({s:live,onMove,low,me,animation=null,throwAnimation=null,previews=[],onAnimationEnd=()=>{},onThrowEnd=()=>{}}:{s:State;onMove:(i:number)=>void;low:boolean;me:number;animation?:AnimationPlan|null;throwAnimation?:ThrowAnimation|null;previews?:{destination:string;id:string}[];onAnimationEnd?:(plan:AnimationPlan)=>void;onThrowEnd?:(plan:ThrowAnimation)=>void}){
 const s=animation?.before||throwAnimation?.before||live;
 const legal=legalMoves(s),elements=useRef(new Map<string,HTMLDivElement>()).current;
 const tokens:VisibleToken[]=s.players.flatMap((p,j)=>{
  if(s.forfeited.includes(j))return [];
  const rendered=new Set<string>();
  return p.pieces.flatMap((piece,i)=>{
   if(piece.node===DONE)return [];
   const atHome=piece.node===HOME;if(!atHome&&rendered.has(piece.node))return [];rendered.add(piece.node);
   let [x,z]=atHome?homePosition(j,i):position(piece.node);
   const shared=!atHome&&s.players.some((other,k)=>k!==j&&!s.forfeited.includes(k)&&other.pieces.some(q=>q.node===piece.node));
   if(shared){x+=(j%2===0?-.5:.5);z+=(j<2?-.3:.3);}
   return [{key:`${j}-${i}`,player:j,index:i,x,z,color:colors[j],characterId:p.character,label:`${j===me?'나':p.name.replace(/^AI /,'AI')} · ${i+1}`,selectable:!animation&&!throwAnimation&&j===me&&s.turn===me&&legal.includes(i),stack:atHome?1:p.pieces.filter(q=>q.node===piece.node).length}];
  });
 });
 return <div className="board-render" data-animating={Boolean(animation)} data-throwing={Boolean(throwAnimation)}><Canvas orthographic shadows={!low} camera={{position:[0,22,16],zoom:32,near:.1,far:150}} dpr={low?1:[1,1.5]}>
  <FitCamera/><PlaybackClock plan={animation} onEnd={onAnimationEnd}/><PlaybackClock plan={throwAnimation} onEnd={onThrowEnd}/>
  <color attach="background" args={['#123b3e']}/>
  <ambientLight intensity={1.9}/><directionalLight position={[6,14,10]} intensity={2.3} castShadow={!low} shadow-mapSize={[1024,1024]}/><directionalLight position={[-8,6,-6]} intensity={1.2}/>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.4,0]} receiveShadow><planeGeometry args={[200,200]}/><meshStandardMaterial color="#123b3e"/></mesh>
  <mesh position={[0,-.18,0]} receiveShadow><boxGeometry args={[11.9,.35,11.9]}/><meshStandardMaterial color="#3c7064" roughness={.85}/></mesh>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,.005,0]}><ringGeometry args={[5.6,5.64,4]}/><meshBasicMaterial color="#799e82" transparent opacity={.25}/></mesh>
  {[["o20","o5","o10","o15","o20"],["o5","c","o15"],["o10","c","o20"]].map((path,i)=><Line key={i} points={path.map(n=>{const [x,z]=position(n);return [x,.04,z]})} color="#dbebc6" lineWidth={3}/>)}
  {nodes.map(n=>{const [x,z]=position(n);const corner=n==='c'||['o5','o10','o15','o20'].includes(n);return <group key={n} position={[x,.06,z]}><mesh rotation={[-Math.PI/2,0,0]}><circleGeometry args={[corner?.48:.3,28]}/><meshStandardMaterial color="#edf2d3"/></mesh>{corner&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.01,0]}><ringGeometry args={[.32,.37,28]}/><meshBasicMaterial color="#426b59"/></mesh>}</group>})}
  {tokens.map(({key,...token})=><Token key={key} {...token} animation={animation} onClick={()=>onMove(token.index)}/>)}
  <ProjectLabels tokens={tokens} elements={elements} animation={animation}/>{animation&&animation.event.captures.length>0&&<CaptureBurst animation={animation}/>}
  {throwAnimation&&<ThrowSticks animation={throwAnimation}/>}
  {previews.map((p,i)=>{const [x,z]=position(p.destination);return <mesh key={p.id} position={[x,.25,z]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.6,.82,32]}/><meshBasicMaterial color={i===0?'#f5d270':'#66bfff'} toneMapped={false}/></mesh>})}
  <OrbitControls makeDefault enablePan={false} minZoom={10} maxZoom={90} minPolarAngle={.1} maxPolarAngle={Math.PI/2.8} target={[0,0,0]}/>
 </Canvas><div className="token-overlay" aria-hidden="true">{tokens.map(token=><div key={token.key} ref={el=>{if(el)elements.set(token.key,el);else elements.delete(token.key)}} data-character={character(token.characterId).id} className={`token-label ${token.selectable?'selectable':''}`} style={{borderColor:token.color}}><i style={{background:token.color}}/><span className="label-caption"><span className="label-name">{token.label.slice(0,token.label.lastIndexOf(' · '))}</span><span className="label-index"><span className="label-separator"> · </span>{token.index+1}</span></span>{token.stack>1&&<strong className="stack-count">×{token.stack}</strong>}{token.selectable&&<em>선택</em>}</div>)}</div></div>;
}
