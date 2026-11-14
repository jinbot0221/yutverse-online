import type {State} from '@yutverse/engine';
export type ThrowAnimation={before:State;event:NonNullable<State['lastThrow']>;start:number;duration:number;reduced:boolean};
export function createThrowAnimation(before:State|undefined,after:State|undefined,start:number,reduced=false):ThrowAnimation|null{
 const event=after?.lastThrow;if(!before||!after||!event||before.players.length!==after.players.length||event.id!==(before.lastThrow?.id||0)+1)return null;
 return {before,event,start,duration:reduced?180:1100,reduced};
}
