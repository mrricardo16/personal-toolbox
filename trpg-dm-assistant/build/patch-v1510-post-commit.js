"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const write=(p,text)=>fs.writeFileSync(path.join(root,p),text,"utf8");

let text=read("src/authored-threat-clock.js");
text=text.replace('new Set(["authored_threat_clock","legacy_pacing"])','new Set(["authored_threat_clock","authored_threat_clock_resolution","legacy_pacing"])');
const anchor='\nconst __authoredBaseApplyDeterministicPacingBeforeAction=applyDeterministicPacingBeforeAction;';
const block=`
function evaluateAuthoredThreatClockResolutions({source="post_commit"}={}){
  const director=state.campaign?.directorState;if(!director)return{changed:false,events:[]};normalizeDirectorClocks(director);const clockIds=authoredClockList(director).map(clock=>clock.id);if(!clockIds.length)return{changed:false,events:[]};const before=progressSemanticSnapshot(),context=authoredClockEvaluationContext(),events=[];
  for(const clockId of clockIds){let clock=authoredClockById(clockId,director);if(!clock||clock.resolved)continue;clock.authoredState=normalizeAuthoredClockState(clock.authoredState);const semantic=context.semantic,semanticForClock=semantic?.id&&clock.authoredState.lastSemanticEventId===semantic.id?null:semantic,ruleContext={...context,semantic:semanticForClock};const resolution=clock.resolveRules.find(rule=>authoredClockRuleCanFire(clock,rule,ruleContext.semantic)&&authoredClockRuleMatches(rule,ruleContext));if(!resolution)continue;clock=resolveThreatClockInDirector(director,clock.id);markAuthoredClockRuleFire(clock,resolution,ruleContext.semantic);events.push({clockId:clock.id,kind:"resolved",ruleId:resolution.id,description:\`威胁时钟“\${clock.name}”按剧本规则解除\`})
  }
  if(!events.length)return{changed:false,events:[]};const event={id:uid("director-event"),kind:"authored_clock_resolved",turn:context.turn,reason:events.map(item=>\`\${item.clockId}:\${item.ruleId}\`).join(", "),events:deepClone(events),source};director.pendingPressure=event;state.runtime.pendingDirectorEvent=event;bumpRevision();const semanticEvent=recordProgressSemantics(before,progressSemanticSnapshot(),{source:"authored_threat_clock_resolution",requestId:null,recordNone:false});addLog("director",\`Authored Threat Clock post-commit：\${events.map(item=>item.description).join("；")}\`,{secret:true});return{changed:true,events,semantic:semanticEvent}
}

const __authoredBaseEnterNode=enterNode;
enterNode=function(...args){const result=__authoredBaseEnterNode(...args);evaluateAuthoredThreatClockResolutions({source:"node_transition"});return result};
const __authoredBaseCommitAiTransaction=commitAiTransaction;
commitAiTransaction=function(...args){const result=__authoredBaseCommitAiTransaction(...args);evaluateAuthoredThreatClockResolutions({source:"ai_commit"});return result};
const __authoredBaseApplySecretCheckOutcome=applySecretCheckOutcome;
applySecretCheckOutcome=function(...args){const result=__authoredBaseApplySecretCheckOutcome(...args);evaluateAuthoredThreatClockResolutions({source:"secret_check"});return result};
`;
if(!text.includes('function evaluateAuthoredThreatClockResolutions(')){
  if(!text.includes(anchor))throw new Error("authored post-commit source anchor missing");
  text=text.replace(anchor,"\n"+block+anchor);
}
if(!text.includes('const __authoredBaseEnterNode=enterNode;'))throw new Error("enterNode post-commit wrapper missing");
write("src/authored-threat-clock.js",text);

text=read("build/test-v1510-authored-threat-clock.js");
const helperAnchor='function __diagnostic(){return deepClone(buildDiagnosticPackage({includeSecrets:false}).authoredThreatClock)}';
const helpers=`function __actualEnterEndingAfterPace(){__ready();__setTurns(1,1,1);applyDeterministicPacingBeforeAction();const before=state.campaign.directorState.clocks[0].current;enterNode("harbor-ending-light",{reason:"authored immediate resolution test"});const clock=state.campaign.directorState.clocks[0];return deepClone({before,clock,last:ensureProgressSemanticsState().last})}
function __postCommitDoesNotAdvance(){const scenario=deepClone(SCENARIO_LIBRARY.find(x=>x.id==="scenario-old-house"));const nodes=allScenarioNodes(scenario),target=nodes[1]?.id||nodes[0].id;scenario.id="scenario-post-commit-no-advance";scenario.director={threatClocks:[{id:"node-pressure",name:"节点压力",current:0,max:3,consequence:"测试",authored:true,advanceRules:[{id:"node-advance",event:"node",nodeId:target,amount:1,once:false}],resolveRules:[{id:"never-resolve",event:"flag",flag:"never",equals:true}]}]};state=makeInitialState();state.character=__character();activateScenario(scenario);__setTurns(1,1,1);applyDeterministicPacingBeforeAction();enterNode(target,{reason:"post commit must not advance"});return deepClone(state.campaign.directorState.clocks[0])}
function __flagResolveViaCommit(){__activateCustom({advanceRules:[],resolveRules:[{id:"safe-flag",event:"flag",flag:"safe",equals:true,once:true}]});const parsed={decision:"no_check",narrative:"安全条件成立。",stateChanges:[{operation:"setScenarioFlag",flag:"safe",value:true}],campaignChanges:[],locationEffect:{type:"stay",targetNodeId:null},nodeProposal:null,endingProposal:null,actionSuggestions:[]};const tx=prepareAiTransaction(parsed);commitAiTransaction(tx,"authored-flag-resolution");return deepClone({clock:state.campaign.directorState.clocks[0],last:ensureProgressSemanticsState().last})}
`;
if(!text.includes('function __actualEnterEndingAfterPace()')){
  if(!text.includes(helperAnchor))throw new Error("v1.5.10 test helper anchor missing");
  text=text.replace(helperAnchor,helpers+helperAnchor);
}
text=text.replace('diagnostic:__diagnostic,state:__state','diagnostic:__diagnostic,actualEnterEndingAfterPace:__actualEnterEndingAfterPace,postCommitDoesNotAdvance:__postCommitDoesNotAdvance,flagResolveViaCommit:__flagResolveViaCommit,state:__state');
const testAnchor='const buildSource=fs.readFileSync(path.join(root,"build/build-single-html.js"),"utf8");';
const tests=`test("实际 enterNode 在本回合 pre-action pacing 后仍立即解决 authored clock",()=>{const r=api.actualEnterEndingAfterPace();assert.equal(r.before,0);assert.equal(r.clock.resolved,true);assert.equal(r.clock.active,false);assert.equal(r.last.source,"authored_threat_clock_resolution");assert(r.last.kinds.includes("RESOLUTION"))});
test("post-commit 解析只允许 resolve 不会借节点变化推进 authored clock",()=>{const c=api.postCommitDoesNotAdvance();assert.equal(c.current,0);assert.equal(c.resolved,false)});
test("AI canonical flag commit 后 authored resolve rule 同回合立即生效",()=>{const r=api.flagResolveViaCommit();assert.equal(r.clock.resolved,true);assert.equal(r.clock.active,false);assert.equal(r.last.source,"authored_threat_clock_resolution");assert(r.last.kinds.includes("RESOLUTION"))});
`;
if(!text.includes('实际 enterNode 在本回合 pre-action pacing 后仍立即解决 authored clock')){
  if(!text.includes(testAnchor))throw new Error("v1.5.10 test insertion anchor missing");
  text=text.replace(testAnchor,tests+testAnchor);
}
if(!text.includes('flagResolveViaCommit:__flagResolveViaCommit'))throw new Error("v1.5.10 post-commit test exports missing");
write("build/test-v1510-authored-threat-clock.js",text);
console.log("V1510_POST_COMMIT_PATCH:PASS");