"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8"),write=(p,t)=>fs.writeFileSync(path.join(root,p),t,"utf8");

let library=read("src/scenarios/library.js");
library=library.replace('const APP_VERSION = "1.6.1";','const APP_VERSION = "1.6.2";');
if(!library.includes('const APP_VERSION = "1.6.2";'))throw new Error("APP_VERSION v1.6.2 patch failed");
write("src/scenarios/library.js",library);

let v161=read("build/test-v161-mechanical-consequence-contract.js");
v161=v161.replace('assert.equal(api.APP_VERSION,"1.6.1");','(()=>{const v=api.APP_VERSION.split(".").map(Number);assert(v[0]>1||v[0]===1&&(v[1]>6||v[1]===6&&v[2]>=1))})();');
if(v161.includes('assert.equal(api.APP_VERSION,"1.6.1")'))throw new Error("v1.6.1 exact version assertion still present");
write("build/test-v161-mechanical-consequence-contract.js",v161);

let v162=read("build/test-v162-failure-forward-cost-engine.js");
const identity='test("v1.6.2 Failure-Forward Cost Engine 加载且 Schema/协议稳定",()=>{assert.equal(api.FAILURE_FORWARD_COST_ENGINE_VERSION,"1.0");';
const releaseIdentity='test("v1.6.2 Failure-Forward Cost Engine 加载且 Schema/协议稳定",()=>{assert.equal(api.APP_VERSION,"1.6.2");assert.equal(api.FAILURE_FORWARD_COST_ENGINE_VERSION,"1.0");';
if(v162.includes(identity))v162=v162.replace(identity,releaseIdentity);
if(!v162.includes('assert.equal(api.APP_VERSION,"1.6.2")'))throw new Error("v1.6.2 release identity assertion patch failed");
write("build/test-v162-failure-forward-cost-engine.js",v162);

let real=read("build/test-real-api-v1513.js");
real=real.replace('"coc-consequence-contract.js"]','"coc-consequence-contract.js","failure-forward-cost-engine.js"]');
real=real.replace('COC_CONSEQUENCE_CONTRACT_VERSION,ready:','COC_CONSEQUENCE_CONTRACT_VERSION,FAILURE_FORWARD_COST_ENGINE_VERSION,ready:');
real=real.replace(/assert\.equal\(api\.APP_VERSION,"1\.6\.1"\)/g,'assert.equal(api.APP_VERSION,"1.6.2")');
real=real.replace(/assert\.equal\(api\.COC_CONSEQUENCE_CONTRACT_VERSION,"1\.0"\);/g,'assert.equal(api.COC_CONSEQUENCE_CONTRACT_VERSION,"1.0");assert.equal(api.FAILURE_FORWARD_COST_ENGINE_VERSION,"1.0");');
if(!real.includes('"failure-forward-cost-engine.js"')||!real.includes('FAILURE_FORWARD_COST_ENGINE_VERSION'))throw new Error("real API runtime did not load v1.6.2 module");
write("build/test-real-api-v1513.js",real);
console.log("V162_RELEASE_PATCH:PASS");
