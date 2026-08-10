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

let gateTest=read("build/test-v1512-ending-resolution-gate.js");
const exposeOld=',sanitize:__sanitize,state:__state};`';
const exposeNew=',sanitize:__sanitize,state:__state,setThreats:items=>{state.campaign.directorState.activeThreats=deepClone(items);return deepClone(state.campaign.directorState.activeThreats)},setOutcome:(key,value)=>{state.campaign.outcomes[key]=value;return deepClone(state.campaign.outcomes)},enter:id=>{enterNode(id,{meaningfulProgress:true,reason:"test"});return deepClone(state)},available:()=>deepClone(availableEndings()),validateRaw:(raw,meta)=>deepClone(validateAiResponse(raw,meta))};`';
if(gateTest.includes(exposeOld))gateTest=gateTest.replace(exposeOld,exposeNew);
gateTest=gateTest.replace('sandbox.state.campaign.directorState.activeThreats=[{id:"t"}]','api.setThreats([{id:"t"}])');
gateTest=gateTest.replace('sandbox.state.campaign.directorState.activeThreats=[]','api.setThreats([])');
gateTest=gateTest.replace('sandbox.state.campaign.outcomes.truth="full"','api.setOutcome("truth","full")');
gateTest=gateTest.replace('sandbox.enterNode("old-study",{meaningfulProgress:true,reason:"test"})','api.enter("old-study")');
gateTest=gateTest.replace('sandbox.availableEndings()','api.available()');
gateTest=gateTest.replace('sandbox.validateAiResponse(raw,{requestId,baseRevision:meta,stage:"action_adjudication"})','api.validateRaw(raw,{requestId,baseRevision:meta,stage:"action_adjudication"})');
gateTest=gateTest.replace('sandbox.endingGateEvaluate(withdraw).ready','api.evaluate("old-withdraw").ready');
for(const marker of ['setThreats:items=>','setOutcome:(key,value)=>','enter:id=>','available:()=>','validateRaw:(raw,meta)=>'])if(!gateTest.includes(marker))throw new Error("v1.5.12 VM helper patch missing: "+marker);
if(gateTest.includes('sandbox.state.'))throw new Error("v1.5.12 test still reads lexical state through sandbox.state");
write("build/test-v1512-ending-resolution-gate.js",gateTest);
console.log("V1512_RELEASE_PATCH:PASS");
