import {getAugmentHelp} from '@yutverse/engine';
export function AugmentHelp({id}:{id:string}){const help=getAugmentHelp(id);if(!help)return null;return <details className="augment-help"><summary>사용법·예시·주의사항</summary><dl><dt>언제·어떻게</dt><dd>{help.how}</dd><dt>예시</dt><dd>{help.example}</dd><dt>알아둘 점</dt><dd>{help.note}</dd></dl></details>}
