import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGameServer} from './server.ts';
const dataDir=resolve(process.env.YUTVERSE_DATA_DIR||fileURLToPath(new URL('../../../data/',import.meta.url)));mkdirSync(dataDir,{recursive:true});
const server=createGameServer({dbPath:resolve(dataDir,'yutverse.sqlite'),staticDir:fileURLToPath(new URL('../../web/dist',import.meta.url)),webOrigin:process.env.WEB_ORIGIN});
server.http.listen(Number(process.env.PORT||3001),process.env.YUTVERSE_BIND_HOST||'0.0.0.0',()=>console.log('Yutverse server listening on port',process.env.PORT||3001));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void server.close().then(()=>process.exit(0));});
