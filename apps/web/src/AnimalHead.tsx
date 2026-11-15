import {character} from '@yutverse/engine';
export function AnimalHead({id}:{id:unknown}){
 const animal=character(id),cat=animal.id==='cat',dog=animal.id==='dog',squirrel=animal.id==='squirrel',fur=animal.color;
 return <group position={[0,.9,0]}>
  {[-1,1].map(side=><group key={side}>
   {cat?<group position={[side*.46,.53,0]} rotation={[0,0,-side*.18]}><mesh><coneGeometry args={[.28,.57,3]}/><meshStandardMaterial color={fur}/></mesh><mesh position={[0,.035,.05]} scale={.63}><coneGeometry args={[.28,.5,3]}/><meshStandardMaterial color="#edb8b8"/></mesh></group>:dog?<mesh position={[side*.62,-.02,0]} rotation={[0,0,side*.22]} scale={[.75,1.35,.8]}><sphereGeometry args={[.33,16,12]}/><meshStandardMaterial color="#89522e"/></mesh>:<group position={[side*.5,.43,-.02]}><mesh><sphereGeometry args={[squirrel?.26:.22,16,12]}/><meshStandardMaterial color={fur}/></mesh><mesh position={[0,0,.13]}><sphereGeometry args={[.14,12,10]}/><meshStandardMaterial color="#e9b99c"/></mesh></group>}
  </group>)}
  <mesh scale={[1,.91,.88]}><sphereGeometry args={[.69,24,18]}/><meshStandardMaterial color={fur} roughness={.8}/></mesh>
  <mesh position={[0,-.2,.43]} scale={[1.25,.77,.55]}><sphereGeometry args={[.46,20,14]}/><meshStandardMaterial color="#fae7cb"/></mesh>
  {[-1,1].map(side=><group key={side}>
   <mesh position={[side*.245,.08,.563]}><sphereGeometry args={[.105,16,12]}/><meshStandardMaterial color="#172727"/></mesh><mesh position={[side*.22,.115,.649]}><sphereGeometry args={[.034,10,8]}/><meshBasicMaterial color="white"/></mesh>
   <mesh position={[side*.39,-.19,.62]} scale={[1,.55,.35]}><sphereGeometry args={[squirrel?.17:.11,12,8]}/><meshStandardMaterial color="#efb7a6"/></mesh>
   {cat&&[0,1].map(i=><mesh key={i} position={[side*.47,-.19-i*.1,.64]} rotation={[0,0,side*(.1+i*.12)]}><boxGeometry args={[.3,.018,.018]}/><meshBasicMaterial color="#5a6770"/></mesh>)}
  </group>)}
  <mesh position={[0,-.12,.733]} scale={[1,.7,.7]}><sphereGeometry args={[.105,14,10]}/><meshStandardMaterial color={cat?'#de91a4':'#352a24'}/></mesh>
  <mesh position={[0,-.27,.69]}><sphereGeometry args={[.05,12,8]}/><meshStandardMaterial color="#674836"/></mesh>
  {(squirrel||animal.id==='otter')&&[-1,1].map(side=><mesh key={side} position={[side*.04,-.33,.71]}><boxGeometry args={[.068,.12,.05]}/><meshStandardMaterial color="#fffbea"/></mesh>)}
  {squirrel&&<mesh position={[0,.6,0]} rotation={[0,0,.15]}><coneGeometry args={[.14,.28,5]}/><meshStandardMaterial color="#955c2b"/></mesh>}
 </group>;
}
