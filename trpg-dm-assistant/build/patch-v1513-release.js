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

let protocol=read("src/ai-protocol.js");
const aliasOld='  const amountOps=new Set(["adjustHp","adjustSan","adjustResource","adjustTension","adjustProgress","advanceClock"]);for(const list of [obj.stateChanges,obj.campaignChanges])if(Array.isArray(list))for(const item of list){if(!isPlainObject(item))continue;if(typeof item.operation==="string")item.operation=item.operation.trim();const idField=operationIdFields[item.operation];if(idField&&item[idField]===undefined&&typeof item.id==="string")item[idField]=item.id.trim();if(!amountOps.has(item.operation)||item.amount!==undefined)continue;for(const alias of ["by","delta"]){if(item[alias]!==undefined&&Number.isFinite(Number(item[alias]))){item.amount=Number(item[alias]);break}}}';
const aliasNew='  const amountOps=new Set(["adjustHp","adjustSan","adjustResource","adjustTension","adjustProgress","advanceClock"]);for(const list of [obj.stateChanges,obj.campaignChanges])if(Array.isArray(list))for(const item of list){if(!isPlainObject(item))continue;if(typeof item.operation==="string")item.operation=item.operation.trim();const idField=operationIdFields[item.operation];if(idField&&item[idField]===undefined&&typeof item.id==="string")item[idField]=item.id.trim();if(item.operation==="addRevealedTruth"&&item.text===undefined&&typeof item.description==="string"&&item.description.trim())item.text=item.description.trim();if(!amountOps.has(item.operation)||item.amount!==undefined)continue;for(const alias of ["by","delta"]){if(item[alias]!==undefined&&Number.isFinite(Number(item[alias]))){item.amount=Number(item[alias]);break}}}';
if(protocol.includes(aliasOld))protocol=protocol.replace(aliasOld,aliasNew);
if(!protocol.includes('item.operation==="addRevealedTruth"&&item.text===undefined&&typeof item.description==="string"'))throw new Error("addRevealedTruth description alias patch failed");
write("src/ai-protocol.js",protocol);

let e2e=read("build/test-v1513-full-case-e2e.js");
const malformed='assert(n.continuity.claims.some(x=>x.includes("地下入口"))});';
const fixed='assert(n.continuity.claims.some(x=>x.includes("地下入口")))});';
if(e2e.includes(malformed))e2e=e2e.replace(malformed,fixed);
const exposeOld='sanitize:__sanitize};`';
const exposeNew='sanitize:__sanitize,normalize:raw=>deepClone(normalizeAiProtocolShape(raw))};`';
if(e2e.includes(exposeOld))e2e=e2e.replace(exposeOld,exposeNew);
if(!e2e.includes('addRevealedTruth description 可窄归一为 text')){
  const anchor='test("核心防御模块全部在同一运行态加载"';
  const at=e2e.indexOf(anchor);if(at<0)throw new Error("v1.5.13 alias test anchor missing");
  const extra='test("addRevealedTruth description 可窄归一为 text",()=>{const n=api.normalize({protocolVersion:"1.3",stateChanges:[],campaignChanges:[{operation:"addRevealedTruth",description:"已确认事实"}]});assert.equal(n.campaignChanges[0].text,"已确认事实");assert.equal(n.campaignChanges[0].operation,"addRevealedTruth")});\n';
  e2e=e2e.slice(0,at)+extra+e2e.slice(at);
}
if(e2e.includes(malformed)||!e2e.includes(fixed)||!e2e.includes('normalize:raw=>deepClone(normalizeAiProtocolShape(raw))')||!e2e.includes('addRevealedTruth description 可窄归一为 text'))throw new Error("v1.5.13 E2E formal patch failed");
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
const paceOld='function __advanceThreat(){const d=state.campaign.directorState;d.sceneTurns=Number(d.sceneTurns||0)+2;d.totalTurns=Number(d.totalTurns||0)+2;d.lastProgressTurn=d.totalTurns-2;return deepClone(applyDeterministicPacingBeforeAction()||null)}';
const paceNew='function __advanceThreat(){const d=state.campaign.directorState;d.sceneTurns=Math.max(Number(d.sceneTurns||0),Number(d.lastProgressTurn||0))+2;d.lastProgressTurn=Math.max(0,d.sceneTurns-2);d.totalTurns=Math.max(Number(d.totalTurns||0)+1,Number(d.authoredClockLastEvaluationTurn??-1)+1);return deepClone(applyDeterministicPacingBeforeAction()||null)}';
if(real.includes(paceOld))real=real.replace(paceOld,paceNew);
if(!real.includes('d.totalTurns=Math.max(Number(d.totalTurns||0)+1,Number(d.authoredClockLastEvaluationTurn??-1)+1)'))throw new Error("real API authored stall patch failed");
write("build/test-real-api-v1513.js",real);
console.log("V1513_RELEASE_PATCH:PASS");
