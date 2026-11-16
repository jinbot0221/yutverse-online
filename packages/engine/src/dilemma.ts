export type DilemmaChoice='cooperate'|'betray';
export function dilemmaReward(mine:DilemmaChoice,other:DilemmaChoice){return mine==='cooperate'?(other==='cooperate'?2:0):(other==='cooperate'?3:1);}
export const DILEMMA_OUTCOMES=([['cooperate','cooperate'],['cooperate','betray'],['betray','cooperate'],['betray','betray']] as const).map(([mine,other])=>({mine,other,mineLabel:mine==='cooperate'?'협력':'배신',otherLabel:other==='cooperate'?'협력':'배신',mineThrows:dilemmaReward(mine,other),otherThrows:dilemmaReward(other,mine)}));
