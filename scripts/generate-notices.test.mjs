import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const generator=fileURLToPath(new URL('./generate-notices.mjs',import.meta.url));
const pythonNotices=readFileSync(new URL('../PYTHON_PACKAGE_NOTICES.md',import.meta.url),'utf8');

function fixture(action,source=pythonNotices){
  const root=mkdtempSync(join(tmpdir(),'leviathan-notice-test-'));
  try{
    const packageDir=join(root,'node_modules','fixture-package');
    mkdirSync(packageDir,{recursive:true});
    mkdirSync(join(root,'site'));
    writeFileSync(join(root,'package-lock.json'),JSON.stringify({packages:{
      'node_modules/fixture-package':{version:'1.2.3',license:'MIT'}
    }}));
    writeFileSync(join(packageDir,'package.json'),JSON.stringify({version:'1.2.3',license:'MIT'}));
    writeFileSync(join(packageDir,'LICENSE'),'Fixture license text\n');
    if(source!==null)writeFileSync(join(root,'PYTHON_PACKAGE_NOTICES.md'),source);
    action(root);
  }finally{
    rmSync(root,{recursive:true,force:true});
  }
}

function run(root){
  return spawnSync(process.execPath,[generator],{cwd:root,encoding:'utf8'});
}

test('both generated notices retain canonical Python and npm attribution across two builds',()=>{
  fixture(root=>{
    let expected;
    for(let build=0;build<2;build++){
      const result=run(root);
      assert.equal(result.status,0,result.stderr);
      const output=readFileSync(join(root,'THIRD_PARTY_NOTICES.md'),'utf8');
      assert.equal(output,readFileSync(join(root,'site','THIRD_PARTY_NOTICES.md'),'utf8'));
      assert.equal(output.split(pythonNotices.trim()).length-1,1);
      assert.match(output,/\| fixture-package \| 1\.2\.3 \| MIT \|/);
      assert.match(output,/Fixture license text/);
      if(build===0){
        expected=output;
        // The second build must recover from its durable sources, not copy old output.
        writeFileSync(join(root,'THIRD_PARTY_NOTICES.md'),'tampered generated output\n');
        writeFileSync(join(root,'site','THIRD_PARTY_NOTICES.md'),'tampered generated output\n');
      }else assert.equal(output,expected);
    }
  });
});

test('missing or empty Python attribution fails before replacing either output',()=>{
  for(const source of [null,'']){
    fixture(root=>{
      for(const name of ['THIRD_PARTY_NOTICES.md','site/THIRD_PARTY_NOTICES.md']){
        writeFileSync(join(root,name),'existing complete notices\n');
      }
      const result=run(root);
      assert.notEqual(result.status,0);
      assert.match(result.stderr,/PYTHON_PACKAGE_NOTICES\.md/);
      for(const name of ['THIRD_PARTY_NOTICES.md','site/THIRD_PARTY_NOTICES.md']){
        assert.equal(readFileSync(join(root,name),'utf8'),'existing complete notices\n');
      }
    },source);
  }
});
