import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyCloudflaredSource} from './cloudflared-source.mjs';

function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'yutverse-tag-'));
 const git=(...args)=>execFileSync('git',['-C',dir,'-c','user.name=Source verifier test','-c','user.email=test@example.invalid',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init','--initial-branch=main');writeFileSync(join(dir,'source.txt'),'original\n');git('add','source.txt');git('commit','-m','Source');
 git('tag','-a','2025.11.1','-m','Annotated release');
 const expected={tag:'2025.11.1',commit:git('rev-parse','HEAD'),tagObject:git('rev-parse','refs/tags/2025.11.1')};
 return {dir,git,expected,close:()=>rmSync(dir,{recursive:true,force:true})};
}
test('annotated tag validates its separate object and peeled source commit, including a shallow clone',()=>{
 const f=fixture(),parent=mkdtempSync(join(tmpdir(),'yutverse-shallow-'));try{
  assert.notEqual(f.expected.commit,f.expected.tagObject);
  assert.equal(verifyCloudflaredSource(f.dir,f.expected),f.expected.commit);
  const clone=join(parent,'source');execFileSync('git',['clone','--quiet','--depth','1','--branch',f.expected.tag,`file://${f.dir}`,clone],{stdio:'pipe'});
  assert.equal(verifyCloudflaredSource(clone,f.expected),f.expected.commit);
 }finally{f.close();rmSync(parent,{recursive:true,force:true});}
});
test('wrong release identities remain rejected; verification is never bypassed',()=>{
 const f=fixture();try{
  assert.throws(()=>verifyCloudflaredSource(f.dir,{...f.expected,commit:f.expected.tagObject}),/identity mismatch/);
  assert.throws(()=>verifyCloudflaredSource(f.dir,{...f.expected,tagObject:'0'.repeat(40)}),/identity mismatch/);
  writeFileSync(join(f.dir,'source.txt'),'new version\n');f.git('add','source.txt');f.git('commit','-m','Different commit');
  assert.throws(()=>verifyCloudflaredSource(f.dir,f.expected),/identity mismatch/);
 }finally{f.close();}
});
test('local source modifications are rejected and preserved',()=>{
 const f=fixture();try{writeFileSync(join(f.dir,'source.txt'),'user changes\n');assert.throws(()=>verifyCloudflaredSource(f.dir,f.expected),/local changes/);assert.equal(readFileSync(join(f.dir,'source.txt'),'utf8'),'user changes\n');}finally{f.close();}
});
