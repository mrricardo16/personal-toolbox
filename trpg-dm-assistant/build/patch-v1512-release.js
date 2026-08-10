"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const write=(p,text)=>fs.writeFileSync(path.join(root,p),text,"utf8");

let library=read("src/scenarios/library.js");
library=library.replace('const APP_VERSION = "1.5.11";','const APP_VERSION = "1.5.12";');
if(!library.includes('const APP_VERSION = "1.5.12";'))throw new Error("APP_VERSION v1.5.12 patch failed");
write("src/scenarios/library.js",library);

let historical=read("build/test-v1511-npc-knowledge-boundary.js");
const exact='assert.equal(api.APP_VERSION,"1.5.11");';
const forward='const v=api.APP_VERSION.split(".").map(Number);assert(v[0]>1||v[0]===1&&(v[1]>5||v[1]===5&&v[2]>=11));';
if(historical.includes(exact))historical=historical.replace(exact,forward);
if(!historical.includes('v[2]>=11'))throw new Error("v1.5.11 forward identity patch failed");
write("build/test-v1511-npc-knowledge-boundary.js",historical);

let gate=read("src/ending-resolution-gate.js");
gate=gate.replace('return{clockId:asString(item.clockId,120)||`clock-${index+1}`,state:ENDING_GATE_CLOCK_STATES.has(String(item.state||""))?String(item.state):"resolved"}','return{clockId:asString(item.clockId,120)||`clock-${index+1}`,state:asString(item.state,40)||"resolved"}');
gate=gate.replace('requiredSemanticKinds:listStrings(ending.requiredSemanticKinds,8,40).filter(kind=>ENDING_GATE_SEMANTIC_KINDS.has(kind)),','requiredSemanticKinds:listStrings(ending.requiredSemanticKinds,8,40),');
gate=gate.replace('  if(required==="triggered")return Boolean(clock.triggered);\n  return Boolean(clock.active)&&!clock.triggered&&!clock.resolved','  if(required==="triggered")return Boolean(clock.triggered);\n  if(required==="active")return Boolean(clock.active)&&!clock.triggered&&!clock.resolved;\n  return false');
gate=gate.replace('  for(const kind of e.requiredSemanticKinds)if(!semanticKinds.has(kind))missing.push({code:"semantic",kind});','  for(const kind of e.requiredSemanticKinds)if(!ENDING_GATE_SEMANTIC_KINDS.has(kind))missing.push({code:"semantic_invalid",kind});else if(!semanticKinds.has(kind))missing.push({code:"semantic",kind});');
gate=gate.replace('active_threats:"仍有活动威胁",semantic:"缺少浏览器确认的进展语义",outcome:"案件结果状态未满足"','active_threats:"仍有活动威胁",semantic:"缺少浏览器确认的进展语义",semantic_invalid:"结局声明了非法进展语义",outcome:"案件结果状态未满足"');
const integrityOld='  for(const raw of scenario?.endings||[]){const ending=normalizeEndingGateDefinition(raw),title=ending.playerTitle||ending.title||ending.id||"未命名结局";\n    for(const nodeId of ending.requiredNodeIds)';
const integrityNew='  for(const raw of scenario?.endings||[]){const ending=normalizeEndingGateDefinition(raw),title=ending.playerTitle||ending.title||ending.id||"未命名结局";\n    for(const kind of listStrings(raw?.requiredSemanticKinds,8,40))if(!ENDING_GATE_SEMANTIC_KINDS.has(kind))issues.push(caseIntegrityIssue("ERROR","ENDING_GATE_SEMANTIC_INVALID",`结局“${title}”声明了非法 Progress Semantic：${kind}。`,{endingId:ending.id,kind}));\n    for(const requirement of Array.isArray(raw?.requiredClockStates)?raw.requiredClockStates:[]){const stateName=asString(requirement?.state,40)||"resolved";if(!ENDING_GATE_CLOCK_STATES.has(stateName))issues.push(caseIntegrityIssue("ERROR","ENDING_GATE_CLOCK_STATE_INVALID",`结局“${title}”声明了非法威胁时钟状态：${stateName}。`,{endingId:ending.id,clockId:asString(requirement?.clockId,120),state:stateName}))}\n    for(const nodeId of ending.requiredNodeIds)';
if(gate.includes(integrityOld))gate=gate.replace(integrityOld,integrityNew);
for(const marker of ['state:asString(item.state,40)||"resolved"','requiredSemanticKinds:listStrings(ending.requiredSemanticKinds,8,40),','code:"semantic_invalid"','ENDING_GATE_SEMANTIC_INVALID','ENDING_GATE_CLOCK_STATE_INVALID'])if(!gate.includes(marker))throw new Error("v1.5.12 gate hardening missing: "+marker);
write("src/ending-resolution-gate.js",gate);

let gateTest=read("build/test-v1512-ending-resolution-gate.js");
const exposeOld=',sanitize:__sanitize,state:__state};`';
const exposeCurrent=',sanitize:__sanitize,state:__state,setThreats:items=>{state.campaign.directorState.activeThreats=deepClone(items);return deepClone(state.campaign.directorState.activeThreats)},setOutcome:(key,value)=>{state.campaign.outcomes[key]=value;return deepClone(state.campaign.outcomes)},enter:id=>{enterNode(id,{meaningfulProgress:true,reason:"test"});return deepClone(state)},available:()=>deepClone(availableEndings()),validateRaw:(raw,meta)=>deepClone(validateAiResponse(raw,meta))};`';
const exposeFinal=',sanitize:__sanitize,state:__state,setThreats:items=>{state.campaign.directorState.activeThreats=deepClone(items);return deepClone(state.campaign.directorState.activeThreats)},setOutcome:(key,value)=>{state.campaign.outcomes[key]=value;return deepClone(state.campaign.outcomes)},enter:id=>{enterNode(id,{meaningfulProgress:true,reason:"test"});return deepClone(state)},available:()=>deepClone(availableEndings()),validateRaw:(raw,meta)=>deepClone(validateAiResponse(raw,meta)),commit:tx=>{commitAiTransaction(tx,"ending-gate-test");return deepClone(state)}};`';
if(gateTest.includes(exposeOld))gateTest=gateTest.replace(exposeOld,exposeFinal);else if(gateTest.includes(exposeCurrent))gateTest=gateTest.replace(exposeCurrent,exposeFinal);
gateTest=gateTest.replace('sandbox.state.campaign.directorState.activeThreats=[{id:"t"}]','api.setThreats([{id:"t"}])');
gateTest=gateTest.replace('sandbox.state.campaign.directorState.activeThreats=[]','api.setThreats([])');
gateTest=gateTest.replace('sandbox.state.campaign.outcomes.truth="full"','api.setOutcome("truth","full")');
gateTest=gateTest.replace('sandbox.enterNode("old-study",{meaningfulProgress:true,reason:"test"})','api.enter("old-study")');
gateTest=gateTest.replace('sandbox.availableEndings()','api.available()');
gateTest=gateTest.replace('sandbox.validateAiResponse(raw,{requestId,baseRevision:meta,stage:"action_adjudication"})','api.validateRaw(raw,{requestId,baseRevision:meta,stage:"action_adjudication"})');
gateTest=gateTest.replace('sandbox.state.scenario.endings.find(x=>x.id==="old-withdraw")','api.state().scenario.endings.find(x=>x.id==="old-withdraw")');
gateTest=gateTest.replace('sandbox.endingGateEvaluate(withdraw).ready','api.evaluate("old-withdraw").ready');
const finalTest='test("生产构建在 NPC Knowledge Boundary 后加载 Ending / Resolution Gate"';
if(!gateTest.includes('premature recovery commit 写入运行态诊断')){
  const extra='test("premature recovery commit 写入运行态诊断且保留合法变化",()=>{api.ready();api.addEnding({requiredFlags:["done"]});const tx=api.prepare({stateChanges:[{operation:"setScenarioFlag",flag:"other",value:true}],endingId:"gate-test"});api.commit(tx);const s=api.state();assert.equal(s.campaign.flags.other,true);assert.equal(s.runtime.pendingEndingProposal,null);assert.equal(s.runtime.endingResolutionGate.lastRecovery.endingId,"gate-test")});\n'+
  'test("非法 requiredSemanticKinds 属于 blocking integrity error",()=>{api.ready();const r=api.integrity(s=>{s.endings=[{id:"bad-sem",title:"bad",requiredSemanticKinds:["BOGUS"]}]});assert(r.blocking);assert(r.issues.some(x=>x.code==="ENDING_GATE_SEMANTIC_INVALID"&&x.severity==="ERROR"))});\n'+
  'test("非法 requiredClockStates state 属于 blocking integrity error",()=>{api.ready();const r=api.integrity(s=>{s.director=s.director||{};s.director.threatClocks=[{id:"known-clock",name:"known",current:0,max:4}];s.endings=[{id:"bad-clock-state",title:"bad",requiredClockStates:[{clockId:"known-clock",state:"paused"}]}]});assert(r.blocking);assert(r.issues.some(x=>x.code==="ENDING_GATE_CLOCK_STATE_INVALID"&&x.severity==="ERROR"))});\n';
  const at=gateTest.indexOf(finalTest);if(at<0)throw new Error("v1.5.12 final test anchor missing");gateTest=gateTest.slice(0,at)+extra+gateTest.slice(at);
}
for(const marker of ['setThreats:items=>','setOutcome:(key,value)=>','enter:id=>','available:()=>','validateRaw:(raw,meta)=>','commit:tx=>','premature recovery commit 写入运行态诊断','ENDING_GATE_SEMANTIC_INVALID','ENDING_GATE_CLOCK_STATE_INVALID'])if(!gateTest.includes(marker))throw new Error("v1.5.12 test hardening missing: "+marker);
if(gateTest.includes('sandbox.state.'))throw new Error("v1.5.12 test still reads lexical state through sandbox.state");
write("build/test-v1512-ending-resolution-gate.js",gateTest);
console.log("V1512_RELEASE_PATCH:PASS");
