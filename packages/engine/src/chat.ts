/** Shared room chat protocol. Chat never changes game state or turn deadlines. */
export const CHAT_REACTIONS = [
 {id:'laugh',emoji:'😂',label:'이게 잡히네!'}, {id:'cool',emoji:'😎',label:'여유 있지'},
 {id:'cry',emoji:'😭',label:'살려주세요'}, {id:'angry',emoji:'😤',label:'복수할 거야!'},
 {id:'clap',emoji:'👏',label:'잘했어요!'}, {id:'chase',emoji:'😈',label:'잡으러 간다!'},
] as const;
export type ChatMessage={id:string;senderId:string;name:string;kind:'text'|'reaction';text:string;reactionId?:string;at:number};
export const CHAT_LIMIT=50;
