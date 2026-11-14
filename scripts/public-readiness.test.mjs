import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {waitForPublicGame,probeEndpoint,PublicProbeError} from './public-readiness.mjs';
const response=url=>({status:200,body:url.endsWith('/api/health')?'{"ok":true}':url.includes('/socket.io/')?'0{"sid":"test-session","upgrades":["websocket"]}':'<div id="root"></div>'});
test('a newly allocated address can fail DNS repeatedly and then pass all three public checks',async()=>{
 let time=0,calls=0;const checked=[],retries=[];
 const result=await waitForPublicGame('https://example.invalid',{now:()=>time,sleep:async ms=>{time+=ms},probe:async url=>{calls++;if(calls<=3)throw new PublicProbeError('DNS is not ready yet',true);checked.push(url);return response(url)},onRetry:retry=>retries.push(retry)});
 assert.equal(result.attempts,4);assert.equal(retries.length,3);assert.equal(checked.length,3);assert.equal(time,6000);
});
test('temporary edge errors and Socket.IO propagation retry the whole verification',async()=>{
 let time=0,handshakes=0,healthChecks=0;
 const result=await waitForPublicGame('https://example.invalid',{now:()=>time,sleep:async ms=>{time+=ms},probe:async url=>{if(url.endsWith('/api/health'))healthChecks++;if(url.includes('/socket.io/')&&++handshakes===1)return {status:502,body:''};return response(url)}});
 assert.equal(result.attempts,2);assert.equal(healthChecks,2);assert.equal(handshakes,2);
});
test('DNS failure remains bounded and never reports a dead address as ready',async()=>{
 let time=0;await assert.rejects(waitForPublicGame('https://example.invalid',{timeoutMs:3000,now:()=>time,sleep:async ms=>{time+=ms},probe:async()=>{throw new PublicProbeError('DNS is not ready yet',true)}}),/No public URL is confirmed/);assert.equal(time,3000);
});
test('permission errors, TLS failures, and wrong application responses are not hidden by retries',async()=>{
 for(const failure of [{status:403,body:'denied'},new PublicProbeError('TLS validation failed'),{status:200,body:'wrong application'}]){
  let attempts=0;await assert.rejects(waitForPublicGame('https://example.invalid',{probe:async()=>{attempts++;if(failure instanceof Error)throw failure;return failure}}));assert.equal(attempts,1);
 }
});
test('user cancellation stops waiting without spawning more probes',async()=>{
 const controller=new AbortController();let attempts=0;await assert.rejects(waitForPublicGame('https://example.invalid',{signal:controller.signal,probe:async()=>{attempts++;throw new PublicProbeError('DNS',true)},sleep:async()=>controller.abort()}),{name:'AbortError'});assert.equal(attempts,1);
});
test('real curl verifies web, API, and Engine.IO replies against a local test server',async()=>{
 const server=createServer((req,res)=>{res.setHeader('Content-Type','text/plain');res.end(response('http://test'+req.url).body)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const result=await waitForPublicGame(`http://127.0.0.1:${server.address().port}`,{timeoutMs:5000});assert.equal(result.attempts,1)}finally{await new Promise(r=>server.close(r))}
});
