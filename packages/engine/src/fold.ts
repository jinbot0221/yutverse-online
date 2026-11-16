import {position} from './index.ts';
export type FoldDirection='horizontal'|'vertical';
// Logical route nodes and history never change when the board is folded.
// Only their physical cell is shared, so the finish edge remains reachable.
export function foldedPosition(node:string,fold?:FoldDirection):[number,number]{const [x,z]=position(node);if(node==='home'||node==='done'||!fold)return [x,z];return [fold==='vertical'?-Math.abs(x):x,fold==='horizontal'?-Math.abs(z):z];}
export function cellKey(s:{special?:{fold?:FoldDirection}},node:string){if(node==='home'||node==='done'||node==='hidden')return node;const [x,z]=foldedPosition(node,s.special?.fold);return `${x.toFixed(3)},${z.toFixed(3)}`;}
export function sameCell(s:{special?:{fold?:FoldDirection}},a:string,b:string){return a===b||cellKey(s,a)===cellKey(s,b);}
// Add the hinge intersection before projection; mapping endpoints alone would
// erase an edge whose two ends land on top of each other after folding.
export function foldedPath(path:string[],fold?:FoldDirection):[number,number][]{
 const points:[number,number][]=[];
 path.forEach((node,i)=>{if(i&&fold){const a=position(path[i-1]),b=position(node),axis=fold==='vertical'?0:1;if(a[axis]*b[axis]<0){const t=-a[axis]/(b[axis]-a[axis]),x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;points.push([fold==='vertical'?-Math.abs(x):x,fold==='horizontal'?-Math.abs(z):z]);}}points.push(foldedPosition(node,fold));});return points;
}
