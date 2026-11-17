export const PIECE_TYPES:Record<string,{name:string;effect:string}>={
 goblin:{name:'도깨비',effect:'일반 이동은 1칸. 특수 이동은 결과 하나를 써서 앞·뒤 1칸.'},
 vanguard:{name:'선봉장',effect:'판 위에 있는 동안 내 전진 이동 +1칸. 전체 보너스 합계 최대 +2칸.'},
 zombie:{name:'좀비',effect:'잡은 말도 좀비로 감염. 전체 말의 절반 이상 감염 시 변환 소유자 승리.'},
 cannon:{name:'포',effect:'한 차례에 한 번 결과 하나를 써서 말이 있는 칸 하나를 넘어 직선 이동.'},
 pawn:{name:'폰',effect:'직접 선택 불가. 실제 윷 던지기마다 자동으로 1칸 전진.'},
 pelican:{name:'펠리컨',effect:'상대를 삼킨 채 완주하면 그 상대 탈락. 잡히면 삼킨 말을 해방.'},
 kim:{name:'김첨지',effect:'정해진 내 여섯 차례 안에 완주하면 승리. 기한 종료 시 탈락.'},
 queen:{name:'중전마마',effect:'완주 불가. 지킨 채 12번 던지면 승리. 마지막 목숨이 잡히면 탈락.'},
 monster:{name:'괴물',effect:'완주 불가. 잡기 목표 달성 시 승리. 공격받으면 목표 잡기 수 증가.'},
 star:{name:'1성',effect:'판 위에서 업힌 말의 성급 합계 8 달성 시 승리.'},
 cultist:{name:'광신도',effect:'내 차례 시작에 미완주 말당 의식 코인 1개. 12개면 승리.'},
 marathon:{name:'마라토너',effect:'이 말 하나만 완주해도 승리.'},
 domain:{name:'영역 전개',effect:'말뭉치 이동 금지. 두 차례 생존하면 승리, 잡히면 탈락.'},
};
export function pieceTypeName(kind?:string){return kind?PIECE_TYPES[kind]?.name||kind:'일반말';}
