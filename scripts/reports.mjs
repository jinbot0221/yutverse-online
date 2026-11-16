import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const [action='list',id,destination]=process.argv.slice(2),dataDir=resolve(process.env.YUTVERSE_DATA_DIR||fileURLToPath(new URL('../data/',import.meta.url))),dbPath=join(dataDir,'yutverse.sqlite');
if(!existsSync(dbPath)){console.log('저장된 제보가 없습니다.');process.exit(0)}
const db=new DatabaseSync(dbPath,{readOnly:true});
try{
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='issue_reports'").get()){console.log('저장된 제보가 없습니다.');process.exitCode=0;}
 else if(action==='list'){const rows=db.prepare('SELECT id,created_at,category,title,screenshot IS NOT NULL AS has_screenshot FROM issue_reports ORDER BY created_at DESC LIMIT 100').all();console.log(rows.length?JSON.stringify(rows,null,2):'저장된 제보가 없습니다.');}
 else if((action==='show'||action==='export')&&/^[a-f0-9-]{36}$/.test(id||'')){
  const row=db.prepare('SELECT * FROM issue_reports WHERE id=?').get(id);if(!row)throw Error('해당 접수 번호의 제보가 없습니다.');
  const {screenshot,...report}=row;report.diagnostics=report.diagnostics?JSON.parse(report.diagnostics):null;report.has_screenshot=Boolean(screenshot);
  if(action==='show')console.log(JSON.stringify(report,null,2));
  else{if(!destination)throw Error('내보낼 폴더를 입력하세요.');const target=resolve(destination);mkdirSync(target,{recursive:true});const jsonPath=join(target,`${id}.json`);if(existsSync(jsonPath))throw Error('같은 접수 번호의 파일이 이미 있습니다. 다른 폴더를 선택하세요.');if(screenshot){const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[row.screenshot_mime];if(!extension)throw Error('저장된 이미지 형식이 잘못되었습니다.');report.screenshot_file=`${id}.${extension}`;writeFileSync(join(target,report.screenshot_file),screenshot,{flag:'wx',mode:0o600});}writeFileSync(jsonPath,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});console.log(`내보냈습니다: ${jsonPath}`);}
 }else throw Error('사용법: npm run reports:list / npm run reports:show -- 접수번호 / npm run reports:export -- 접수번호 폴더');
}catch(error){console.error(error.message);process.exitCode=1}finally{db.close()}
