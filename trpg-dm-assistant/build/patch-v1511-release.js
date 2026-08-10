"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const write=(p,text)=>fs.writeFileSync(path.join(root,p),text,"utf8");

let library=read("src/scenarios/library.js");
library=library.replace('const APP_VERSION = "1.5.10";','const APP_VERSION = "1.5.11";');
if(!library.includes('const APP_VERSION = "1.5.11";'))throw new Error("APP_VERSION patch failed");
if(!library.includes('"old-secret-door-fact"')){
  const anchor='"keeperGuide":"沈墨发现商会以尸体保存技术掩盖非法实验，被困于地下封存室。关键线索分散在管家房、书房和档案室；失败不应卡死，可用噪声、气味或 NPC 反应提供替代推进。","chapters":';
  const director='"keeperGuide":"沈墨发现商会以尸体保存技术掩盖非法实验，被困于地下封存室。关键线索分散在管家房、书房和档案室；失败不应卡死，可用噪声、气味或 NPC 反应提供替代推进。","director":{"knowledgeFacts":[{"id":"old-secret-door-fact","text":"书房书架后存在通往地下区域的暗门。","aliases":["书房后的暗门","书架后的暗门","书后暗门"],"knownBy":["old-butler"],"learnableFromClueIds":["old-scratch","old-blueprint"]},{"id":"old-low-temp-plan-fact","text":"商会正在资助名为低温封存的计划。","aliases":["低温封存计划","商会资助低温封存"],"knownBy":["old-shen"],"learnableFromClueIds":["old-ledger"]},{"id":"old-underground-experiment-fact","text":"地下封存区正在用遗体进行非法实验。","aliases":["地下非法实验","遗体非法实验","用遗体进行非法实验"],"knownBy":["old-shen"],"learnableFromClueIds":["old-notes"]},{"id":"old-shen-location-fact","text":"沈墨被锁在地下封存区的内侧冷库。","aliases":["沈墨被锁在内侧冷库","沈墨在地下冷库","沈墨被关在冷库"],"knownBy":["old-shen"],"learnableFromClueIds":[]}]},"chapters":';
  if(!library.includes(anchor))throw new Error("old-house knowledgeFacts anchor missing");
  library=library.replace(anchor,director);
}
if(!library.includes('"old-underground-experiment-fact"'))throw new Error("old-house knowledgeFacts injection failed");
write("src/scenarios/library.js",library);

let historical=read("build/test-v1510-authored-threat-clock.js");
const exact='assert.equal(api.APP_VERSION,"1.5.10");';
const forward='const v=api.APP_VERSION.split(".").map(Number);assert(v[0]>1||v[0]===1&&(v[1]>5||v[1]===5&&v[2]>=10));';
if(historical.includes(exact))historical=historical.replace(exact,forward);
if(!historical.includes('v[2]>=10'))throw new Error("v1.5.10 forward identity patch failed");
write("build/test-v1510-authored-threat-clock.js",historical);
console.log("V1511_RELEASE_PATCH:PASS");
