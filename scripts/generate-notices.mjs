import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';

const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
const packages=Object.entries(lock.packages).filter(([path])=>path.startsWith('node_modules/'));
const rows=packages.map(([path,info])=>{
  const name=path.slice('node_modules/'.length);
  let license=info.license||'See package';
  const folder=join('node_modules',name);
  if(existsSync(join(folder,'package.json'))){
    const manifest=JSON.parse(readFileSync(join(folder,'package.json'),'utf8'));
    license=manifest.license||license;
  }
  return {name,version:info.version,license,folder};
}).sort((a,b)=>a.name.localeCompare(b.name));
let out='# Third-party package notices\n\n';
out+='Generated from package-lock.json and installed package manifests. These packages retain their own licenses and copyrights. Generated bundles additionally preserve external legal comments.\n\n';
out+='| Package | Version | License declared by package |\n| --- | --- | --- |\n';
for(const row of rows)out+=`| ${row.name} | ${row.version} | ${row.license} |\n`;
out+='\n## License texts supplied by installed packages\n\n';
const emitted=new Set();
for(const row of rows){
  if(!existsSync(row.folder))continue;
  const candidate=readdirSync(row.folder).find(n=>/^(license|licence)(\.[^/]*)?$/i.test(n));
  if(!candidate)continue;
  const body=readFileSync(join(row.folder,candidate),'utf8').trim();
  if(emitted.has(body))continue;
  emitted.add(body);
  out+=`### ${row.name} ${row.version}\n\n\`\`\`text\n${body}\n\`\`\`\n\n`;
}
mkdirSync('site',{recursive:true});
out=out.trimEnd()+'\n';
writeFileSync('THIRD_PARTY_NOTICES.md',out);
writeFileSync('site/THIRD_PARTY_NOTICES.md',out);
