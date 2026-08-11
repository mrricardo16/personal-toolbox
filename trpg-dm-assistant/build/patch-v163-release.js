"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8"),write=(p,t)=>fs.writeFileSync(path.join(root,p),t,"utf8");

let library=read("src/scenarios/library.js");
library=library.replace('const APP_VERSION = "1.6.2";','const APP_VERSION = "1.6.3";');
if(!library.includes('const APP_VERSION = "1.6.3";'))throw new Error("APP_VERSION v1.6.3 patch failed");
write("src/scenarios/library.js",library);

let v162=read("build/test-v162-failure-forward-cost-engine.js");
v162=v162.replace('assert.equal(api.APP_VERSION,"1.6.2");','(()=>{const v=api.APP_VERSION.split(".").map(Number);assert(v[0]>1||v[0]===1&&(v[1]>6||v[1]===6&&v[2]>=2))})();');
if(v162.includes('assert.equal(api.APP_VERSION,"1.6.2")'))throw new Error("v1.6.2 exact version assertion still present");
write("build/test-v162-failure-forward-cost-engine.js",v162);

let v163=read("build/test-v163-san-loss-resolution.js");
const identity='await test("v1.6.3 SAN Loss Resolution 模块加载且 Schema/协议稳定",async()=>{assert.equal(api.SAN_LOSS_RESOLUTION_VERSION,"1.0");';
const releaseIdentity='await test("v1.6.3 SAN Loss Resolution 模块加载且 Schema/协议稳定",async()=>{assert.equal(api.APP_VERSION,"1.6.3");assert.equal(api.SAN_LOSS_RESOLUTION_VERSION,"1.0");';
if(v163.includes(identity))v163=v163.replace(identity,releaseIdentity);
if(!v163.includes('assert.equal(api.APP_VERSION,"1.6.3")'))throw new Error("v1.6.3 release identity assertion patch failed");
write("build/test-v163-san-loss-resolution.js",v163);

let real=read("build/test-real-api-v1513.js");
real=real.replace('"failure-forward-cost-engine.js"]','"failure-forward-cost-engine.js","san-loss-resolution.js"]');
real=real.replace('FAILURE_FORWARD_COST_ENGINE_VERSION,ready:','FAILURE_FORWARD_COST_ENGINE_VERSION,SAN_LOSS_RESOLUTION_VERSION,ready:');
real=real.replace(/assert\.equal\(api\.APP_VERSION,"1\.6\.2"\)/g,'assert.equal(api.APP_VERSION,"1.6.3")');
real=real.replace(/assert\.equal\(api\.FAILURE_FORWARD_COST_ENGINE_VERSION,"1\.0"\);/g,'assert.equal(api.FAILURE_FORWARD_COST_ENGINE_VERSION,"1.0");assert.equal(api.SAN_LOSS_RESOLUTION_VERSION,"1.0");');
if(!real.includes('"san-loss-resolution.js"')||!real.includes('SAN_LOSS_RESOLUTION_VERSION'))throw new Error("real API runtime did not load v1.6.3 module");
write("build/test-real-api-v1513.js",real);
console.log("V163_RELEASE_PATCH:PASS");
