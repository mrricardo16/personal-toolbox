"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const write=(p,text)=>fs.writeFileSync(path.join(root,p),text,"utf8");

let library=read("src/scenarios/library.js");
library=library.replace('const APP_VERSION = "1.5.12";','const APP_VERSION = "1.5.13";');
if(!library.includes('const APP_VERSION = "1.5.13";'))throw new Error("APP_VERSION v1.5.13 patch failed");
write("src/scenarios/library.js",library);

let historical=read("build/test-v1512-ending-resolution-gate.js");
const exact='assert.equal(api.APP_VERSION,"1.5.12");';
const forward='const v=api.APP_VERSION.split(".").map(Number);assert(v[0]>1||v[0]===1&&(v[1]>5||v[1]===5&&v[2]>=12));';
if(historical.includes(exact))historical=historical.replace(exact,forward);
if(!historical.includes('v[2]>=12'))throw new Error("v1.5.12 forward identity patch failed");
write("build/test-v1512-ending-resolution-gate.js",historical);

let e2e=read("build/test-v1513-full-case-e2e.js");
const malformed='assert(n.continuity.claims.some(x=>x.includes("地下入口"))});';
const fixed='assert(n.continuity.claims.some(x=>x.includes("地下入口")))});';
if(e2e.includes(malformed))e2e=e2e.replace(malformed,fixed);
if(e2e.includes(malformed)||!e2e.includes(fixed))throw new Error("v1.5.13 E2E syntax patch failed");
write("build/test-v1513-full-case-e2e.js",e2e);
console.log("V1513_RELEASE_PATCH:PASS");
