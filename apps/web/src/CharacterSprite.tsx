import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {useTexture} from '@react-three/drei';
import {SRGBColorSpace,type SpriteMaterial} from 'three';
import {character} from '@yutverse/engine';
import {samplePose,type AnimationPlan,type MotionToken} from './motion';

export function CharacterSprite({id,token,animation}:{id:unknown;token:MotionToken;animation:AnimationPlan|null}){
 const atlas=useTexture('/characters/heroes.png'),c=character(id),material=useRef<SpriteMaterial>(null);
 const texture=useMemo(()=>{const map=atlas.clone();map.colorSpace=SRGBColorSpace;map.repeat.set(1/3,1/2);map.offset.set(c.column/3,(1-c.row)/2);map.needsUpdate=true;return map},[atlas,c.id]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 useFrame(()=>{if(!material.current)return;const elapsed=animation?performance.now()-animation.start:0;const pose=samplePose(token,animation,elapsed);material.current.rotation=pose.roll+(pose.kind==='move'&&!animation?.reduced&&Number.isFinite(elapsed)?Math.sin(elapsed/90)*.045:0)});
 return <sprite position={[0,.15,0]} scale={[3.05,3.05,1]} center={[.5,c.row===0?.24:.15]} renderOrder={5}><spriteMaterial ref={material} map={texture} transparent alphaTest={.03} depthWrite={false} toneMapped={false}/></sprite>;
}
