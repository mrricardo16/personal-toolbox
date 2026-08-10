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

let real=read("build/test-real-api-v1513.js");
const realOld=';scheduleAutosave=()=>{};renderAll=()=>{};';
const realNew=';scheduleAutosave=()=>{};maybeAutoSummarize=()=>{};renderAll=()=>{};';
if(real.includes(realOld))real=real.replace(realOld,realNew);
if(!real.includes('maybeAutoSummarize=()=>{};'))throw new Error("real API summarization isolation patch failed");
const runOld='async function runAction(text,options={}){const before=api.state().revision,ok=await api.action(text);stats.actions++;if(!ok){const s=api.state();if(s.runtime.failedRequest?.recoverable){stats.gracefulFallbacksObserved++;api.dismissRecovery();assertCanonical();return{graceful:true}}stats.hardFailures++;throw new Error("player action failed without graceful provider recovery: "+String(s.runtime.lastError?.code||s.runtime.failedRequest?.errorCode||"unknown"))}await settle(options);assert(api.state().revision>=before);assertCanonical();scanNarrative();return{graceful:false}}';
const runNew='async function runAction(text,options={}){const before=api.state().revision,ok=await api.action(text);stats.actions++;if(!ok){const s=api.state();if(s.runtime.failedRequest?.recoverable){stats.gracefulFallbacksObserved++;api.dismissRecovery();assertCanonical();return{graceful:true}}stats.hardFailures++;const err=s.runtime.lastError||{},raw=String(s.runtime.lastRawAiResponse||"").slice(0,5000);console.error("REAL_API_V1513_STRICT_FAILURE:"+JSON.stringify({action:text,phase:s.runtime.phase,code:err.code||s.runtime.failedRequest?.errorCode||null,message:err.message||null,details:err.details||null,rawResponse:raw}));throw new Error("player action failed without graceful provider recovery: "+String(err.code||s.runtime.failedRequest?.errorCode||"unknown"))}await settle(options);assert(api.state().revision>=before);assertCanonical();scanNarrative();return{graceful:false}}';
if(real.includes(runOld))real=real.replace(runOld,runNew);
if(!real.includes('REAL_API_V1513_STRICT_FAILURE:'))throw new Error("real API strict failure diagnostics patch failed");
write("build/test-real-api-v1513.js",real);
console.log("V1513_RELEASE_PATCH:PASS");
