import {execFileSync} from 'node:child_process';

export const CLOUDFLARED_SOURCE=Object.freeze({
 tag:'2025.11.1',
 tagObject:'690f20c008b4b6d2f12756618b9136ef6d5e2f18',
 commit:'17533b124c225c9090ef1de5cd2ee201e8c398e8',
});

// An annotated tag has its own object ID, distinct from the commit it points to.
// Check both identities instead of comparing HEAD to the tag object.
export function verifyCloudflaredSource(directory,expected=CLOUDFLARED_SOURCE){
 const git=(...args)=>execFileSync('git',['-C',directory,...args],{encoding:'utf8'}).trim();
 const head=git('rev-parse','--verify','HEAD^{commit}');
 const tagObject=git('rev-parse','--verify',`refs/tags/${expected.tag}^{tag}`);
 const taggedCommit=git('rev-parse','--verify',`refs/tags/${expected.tag}^{commit}`);
 if(tagObject!==expected.tagObject||taggedCommit!==expected.commit||head!==expected.commit){
  throw Error(`Cloudflared source identity mismatch. Expected commit ${expected.commit}; found HEAD ${head}, tag commit ${taggedCommit}, tag object ${tagObject}. Cached source was preserved.`);
 }
 if(git('status','--porcelain'))throw Error('Cached source has local changes; refusing to build it.');
 return head;
}
