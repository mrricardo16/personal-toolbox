"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const write=(p,t)=>fs.writeFileSync(path.join(root,p),t,"utf8");

let library=read("src/scenarios/library.js");
library=library.replace('const APP_VERSION = "1.5.13";','const APP_VERSION = "1.6.0";');
if(!library.includes('const APP_VERSION = "1.6.0";'))throw new Error("APP_VERSION v1.6.0 patch failed");
write("src/scenarios/library.js",library);

/* Old 1.5.x tests that compared only the patch component break correctly ordered 1.6.0. Rewrite only that flawed version predicate; behavior assertions remain untouched. */
for(const name of fs.readdirSync(path.join(root,"build")).filter(name=>/^test-v\d+.*\.js$/.test(name))){
  const rel="build/"+name;let text=read(rel);
  text=text.replace(/Number\(api\.APP_VERSION\.split\("\."\)\[2\]\)>=(\d+)/g,(_,patch)=>`(()=>{const v=api.APP_VERSION.split(".").map(Number);return v[0]>1||v[0]===1&&(v[1]>5||v[1]===5&&v[2]>=${patch})})()`);
  write(rel,text)
}

let oldE2E=read("build/test-v1513-full-case-e2e.js");
const oldExact='assert.equal(api.APP_VERSION,"1.5.13");assert.equal(api.SCHEMA_VERSION,8);assert.equal(api.AI_PROTOCOL_VERSION,"1.3")';
const oldForward='const v=api.APP_VERSION.split(".").map(Number);assert(v[0]>1||v[0]===1&&(v[1]>5||v[1]===5&&v[2]>=13));assert.equal(api.SCHEMA_VERSION,8);assert.equal(api.AI_PROTOCOL_VERSION,"1.3")';
if(oldE2E.includes(oldExact))oldE2E=oldE2E.replace(oldExact,oldForward);
if(!oldE2E.includes('v[2]>=13'))throw new Error("v1.5.13 forward identity patch failed");
write("build/test-v1513-full-case-e2e.js",oldE2E);

let protocol=read("src/ai-protocol.js");
const transportOld='  }catch(error){if(error.name==="AbortError")throw new Error("请求已取消或超时");if(error instanceof TypeError)throw new Error("网络请求失败，可能是 CORS、网络不可达或本地 file:// 来源被服务端拒绝");throw error}\n  finally{clearTimeout(timeout);if(activeAbortController===controller)activeAbortController=null}\n}';
const transportNew='  }catch(error){const abortReason=controller.signal?.aborted?controller.signal.reason:null;if(abortReason==="timeout")throw protocolError("AI_PROVIDER_TIMEOUT","AI 服务响应超时",{retryable:true});if(abortReason==="user")throw protocolError("AI_REQUEST_CANCELLED","请求已取消");if(error.name==="AbortError")throw new Error("请求已取消或超时");if(error instanceof TypeError)throw new Error("网络请求失败，可能是 CORS、网络不可达或本地 file:// 来源被服务端拒绝");throw error}\n  finally{clearTimeout(timeout);if(activeAbortController===controller)activeAbortController=null}\n}';
if(protocol.includes(transportOld))protocol=protocol.replace(transportOld,transportNew);
if(!protocol.includes('abortReason==="timeout"')||!protocol.includes('abortReason==="user"'))throw new Error("explicit abort reason classification patch failed");
write("src/ai-protocol.js",protocol);

let v160=read("build/test-v160-coc-resolution-engine.js");
const identityOld='assert.equal(api.COC_RESOLUTION_ENGINE_VERSION,"1.0");assert.equal(api.COC_RESOLUTION_AUTHORITY,"browser_coc_resolution");assert.equal(api.SCHEMA_VERSION,8);assert.equal(api.AI_PROTOCOL_VERSION,"1.3")';
const identityNew='assert.equal(api.APP_VERSION,"1.6.0");assert.equal(api.COC_RESOLUTION_ENGINE_VERSION,"1.0");assert.equal(api.COC_RESOLUTION_AUTHORITY,"browser_coc_resolution");assert.equal(api.SCHEMA_VERSION,8);assert.equal(api.AI_PROTOCOL_VERSION,"1.3")';
if(v160.includes(identityOld))v160=v160.replace(identityOld,identityNew);
if(!v160.includes('assert.equal(api.APP_VERSION,"1.6.0")'))throw new Error("v1.6 test release identity patch failed");
write("build/test-v160-coc-resolution-engine.js",v160);

let real=read("build/test-real-api-v1513.js");
const modulesOld='"ending-resolution-gate.js"]';
const modulesNew='"ending-resolution-gate.js","coc-resolution-engine.js"]';
if(real.includes(modulesOld))real=real.replace(modulesOld,modulesNew);
const exposeOld='globalThis.__test={APP_VERSION,SCHEMA_VERSION,AI_PROTOCOL_VERSION,API_RESPONSE_RESILIENCE_VERSION,';
const exposeNew='globalThis.__test={APP_VERSION,SCHEMA_VERSION,AI_PROTOCOL_VERSION,API_RESPONSE_RESILIENCE_VERSION,COC_RESOLUTION_ENGINE_VERSION,';
if(real.includes(exposeOld))real=real.replace(exposeOld,exposeNew);
const realIdentityOld='assert.equal(api.APP_VERSION,"1.5.13");assert.equal(api.SCHEMA_VERSION,8);assert.equal(api.AI_PROTOCOL_VERSION,"1.3");assert.equal(api.API_RESPONSE_RESILIENCE_VERSION,"1.0");';
const realIdentityNew='assert.equal(api.APP_VERSION,"1.6.0");assert.equal(api.SCHEMA_VERSION,8);assert.equal(api.AI_PROTOCOL_VERSION,"1.3");assert.equal(api.API_RESPONSE_RESILIENCE_VERSION,"1.0");assert.equal(api.COC_RESOLUTION_ENGINE_VERSION,"1.0");';
if(real.includes(realIdentityOld))real=real.replace(realIdentityOld,realIdentityNew);
const strictOld='console.error("REAL_API_V1513_STRICT_FAILURE:"+JSON.stringify({action:text,phase:s.runtime.phase,code:err.code||s.runtime.failedRequest?.errorCode||null,message:err.message||null,details:err.details||null,rawResponse:raw}))';
const strictNew='console.error("REAL_API_V1513_STRICT_FAILURE:"+JSON.stringify({action:text,phase:s.runtime.phase,code:err.code||s.runtime.failedRequest?.errorCode||null,message:err.message||s.runtime.failedRequest?.errorMessage||null,details:err.details||s.runtime.failedRequest?.errorDetails||null,rawResponse:raw}))';
if(real.includes(strictOld))real=real.replace(strictOld,strictNew);
if(!real.includes('"coc-resolution-engine.js"')||!real.includes('api.COC_RESOLUTION_ENGINE_VERSION,"1.0"')||!real.includes('s.runtime.failedRequest?.errorMessage'))throw new Error("real API v1.6 runtime patch failed");
write("build/test-real-api-v1513.js",real);

console.log("V160_RELEASE_PATCH:PASS");
