import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import type {Group} from 'three';
import type {ThrowAnimation} from './throw-motion';
export function ThrowSticks({animation}:{animation:ThrowAnimation}){
 const groups=useRef<(Group|null)[]>([]);
 useFrame(()=>{
  const t=Math.max(0,Math.min(1,(performance.now()-animation.start)/animation.duration));
  groups.current.forEach((group,i)=>{if(!group)return;const landed=animation.event.result.sticks?.[i]??false;group.position.set((i-1.5)*1.1,.35+(animation.reduced?0:Math.sin(t*Math.PI)*4.5),1-t*1.3);group.rotation.set((landed?0:Math.PI)+(animation.reduced?0:(1-t)*Math.PI*(6+i)),(i-1.5)*.12,(animation.reduced?0:(1-t)*Math.PI*4));});
 });
 return <group>{[0,1,2,3].map(i=><group key={i} ref={g=>{groups.current[i]=g}}><mesh castShadow><boxGeometry args={[.34,.22,1.8]}/><meshStandardMaterial color="#d6ab6a" roughness={.6}/></mesh><mesh position={[0,.116,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.29,1.68]}/><meshStandardMaterial color="#ffe2a7"/></mesh>{[-.5,0,.5].map(z=><mesh key={z} position={[0,.122,z]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.07,12]}/><meshBasicMaterial color="#563927"/></mesh>)}{i===0&&<mesh position={[0,-.116,0]} rotation={[Math.PI/2,0,0]}><circleGeometry args={[.1,14]}/><meshBasicMaterial color="#b84b39"/></mesh>}</group>)}</group>;
}
