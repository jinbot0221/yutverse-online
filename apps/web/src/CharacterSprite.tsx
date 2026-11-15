import {AnimalHead} from './AnimalHead';
import type {AnimationPlan,MotionToken} from './motion';
export function CharacterSprite({id}:{id:unknown;token:MotionToken;animation:AnimationPlan|null}){return <AnimalHead id={id}/>}
