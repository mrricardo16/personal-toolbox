"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8"),write=(p,t)=>fs.writeFileSync(path.join(root,p),t,"utf8");

let library=read("src/scenarios/library.js");
library=library.replace('const APP_VERSION = "1.6.0";','const APP_VERSION = "1.6.1";');
if(!library.includes('const APP_VERSION = "1.6.1";'))throw new Error("APP_VERSION v1.6.1 patch failed");
write("src/scenarios/library.js",library);

let v160=read("build/test-v160-coc-resolution-engine.js");
const exact160='assert.equal(api.APP_VERSION,"1.6.0");';
const forward160='const v=api.APP_VERSION.split(".").map(Number);assert(v[0]>1||v[0]===1&&(v[1]>6||v[1]===6&&v[2]>=0));';
if(v160.includes(exact160))v160=v160.replace(exact160,forward160);
if(!v160.includes('v[1]>6||v[1]===6&&v[2]>=0'))throw new Error("v1.6.0 forward identity patch failed");
write("build/test-v160-coc-resolution-engine.js",v160);

let v161=read("build/test-v161-mechanical-consequence-contract.js");
const identity='test("v1.6.1 Consequence Contract 模块加载且 Schema/协议稳定",()=>{assert.equal(api.COC_CONSEQUENCE_CONTRACT_VERSION,"1.0");';
const identityRelease='test("v1.6.1 Consequence Contract 模块加载且 Schema/协议稳定",()=>{assert.equal(api.APP_VERSION,"1.6.1");assert.equal(api.COC_CONSEQUENCE_CONTRACT_VERSION,"1.0");';
if(v161.includes(identity))v161=v161.replace(identity,identityRelease);
if(!v161.includes('assert.equal(api.APP_VERSION,"1.6.1")'))throw new Error("v1.6.1 release identity assertion patch failed");
write("build/test-v161-mechanical-consequence-contract.js",v161);

let real=read("build/test-real-api-v1513.js");
real=real.replace('"coc-resolution-engine.js"]','"coc-resolution-engine.js","coc-consequence-contract.js"]');
real=real.replace('COC_RESOLUTION_ENGINE_VERSION,ready:','COC_RESOLUTION_ENGINE_VERSION,COC_CONSEQUENCE_CONTRACT_VERSION,ready:');
real=real.replace(/assert\.equal\(api\.APP_VERSION,"1\.6\.0"\)/g,'assert.equal(api.APP_VERSION,"1.6.1")');
real=real.replace(/assert\.equal\(api\.COC_RESOLUTION_ENGINE_VERSION,"1\.0"\);/g,'assert.equal(api.COC_RESOLUTION_ENGINE_VERSION,"1.0");assert.equal(api.COC_CONSEQUENCE_CONTRACT_VERSION,"1.0");');
if(!real.includes('"coc-consequence-contract.js"')||!real.includes('COC_CONSEQUENCE_CONTRACT_VERSION'))throw new Error("real API runtime did not load v1.6.1 module");
write("build/test-real-api-v1513.js",real);

console.log("V161_RELEASE_PATCH:PASS");
