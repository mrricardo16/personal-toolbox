"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const write=(p,text)=>fs.writeFileSync(path.join(root,p),text,"utf8");

let text=read("src/scenarios/library.js");
if(text.includes('const APP_VERSION = "1.5.9";'))text=text.replace('const APP_VERSION = "1.5.9";','const APP_VERSION = "1.5.10";');
if(!text.includes('const APP_VERSION = "1.5.10";'))throw new Error("APP_VERSION wiring failed");
const anchor='"keeperGuide":"海燕号运输一件会发出低频呼唤的海底石碑。走私者将船引到灯塔下的潮洞卸货，石碑正在诱使听见声音的人走向海中。倒计时以午夜潮汐体现。","chapters":';
const director='"keeperGuide":"海燕号运输一件会发出低频呼唤的海底石碑。走私者将船引到灯塔下的潮洞卸货，石碑正在诱使听见声音的人走向海中。倒计时以午夜潮汐体现。","director":{"threatClocks":[{"id":"harbor-tide","name":"午夜涨潮","current":0,"max":4,"consequence":"旧防波堤与潮洞退路被上涨海水切断。","authored":true,"maxAdvancePerEvaluation":1,"advanceRules":[{"id":"harbor-stall-pressure","event":"stall","turns":3,"amount":1,"once":false,"cooldownTurns":2},{"id":"harbor-threat-pressure","event":"semantic","kinds":["THREAT"],"amount":1,"once":false,"cooldownTurns":1}],"resolveRules":[{"id":"harbor-safe-exit","event":"node","nodeIds":["harbor-ending-light","harbor-ending-rescue","harbor-ending-flood"],"once":true}]}]},"chapters":';
if(!text.includes('"id":"harbor-tide"')){if((text.match(new RegExp(anchor.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"))||[]).length!==1)throw new Error("fog harbor anchor not unique");text=text.replace(anchor,director)}
if(!text.includes('"id":"harbor-tide"'))throw new Error("fog harbor authored clock wiring failed");
write("src/scenarios/library.js",text);

text=read("build/build-single-html.js");
if(!text.includes('"authored-threat-clock.js"'))text=text.replace('  "progress-semantics.js"\n];','  "progress-semantics.js",\n  "authored-threat-clock.js"\n];');
if(text.indexOf('"authored-threat-clock.js"')<=text.indexOf('"progress-semantics.js"'))throw new Error("build order wiring failed");
write("build/build-single-html.js",text);

text=read("build/verify-single-html.js");
if(!text.includes('"src/authored-threat-clock.js"'))text=text.replace('  "src/progress-semantics.js",','  "src/progress-semantics.js",\n  "src/authored-threat-clock.js",');
if(!text.includes('"src/authored-threat-clock.js"'))throw new Error("verifier wiring failed");
write("build/verify-single-html.js",text);

text=read("build/test-v159-progress-semantics.js");
const old='assert.equal(api.APP_VERSION,"1.5.9");assert.equal(api.SCHEMA_VERSION,8);';
const compatible='const v=api.APP_VERSION.split(".").map(Number);assert(v[0]>1||v[0]===1&&(v[1]>5||v[1]===5&&v[2]>=9));assert.equal(api.SCHEMA_VERSION,8);';
if(text.includes(old))text=text.replace(old,compatible);
if(!text.includes(compatible))throw new Error("v1.5.9 forward compatibility wiring failed");
text=text.replace('版本升级为 v1.5.9 且 Schema/协议不变','版本不低于 v1.5.9 且 Schema/协议不变');
write("build/test-v159-progress-semantics.js",text);

text=read("src/authored-threat-clock.js");
const start=text.indexOf("function evaluateAuthoredThreatClocks(){");
const end=text.indexOf("\n\nconst __authoredBaseApplyDeterministicPacingBeforeAction",start);
if(start<0||end<0)throw new Error("authored evaluator anchor missing");
const evaluator=`function evaluateAuthoredThreatClocks(){
  const director=state.campaign.directorState={...defaultDirectorState(),...(state.campaign.directorState||{})};normalizeDirectorClocks(director);const clockIds=authoredClockList(director).map(clock=>clock.id);if(!clockIds.length)return{changed:false,events:[]};const before=progressSemanticSnapshot(),context=authoredClockEvaluationContext(),events=[];
  if(Number(director.authoredClockLastEvaluationTurn??-1)===context.turn)return{changed:false,events:[],skipped:"already_evaluated"};director.authoredClockLastEvaluationTurn=context.turn;
  for(const clockId of clockIds){let clock=authoredClockById(clockId,director);if(!clock)continue;clock.authoredState=normalizeAuthoredClockState(clock.authoredState);const semantic=context.semantic,semanticForClock=semantic?.id&&clock.authoredState.lastSemanticEventId===semantic.id?null:semantic,ruleContext={...context,semantic:semanticForClock};
    if(!clock.resolved){const resolution=clock.resolveRules.find(rule=>authoredClockRuleCanFire(clock,rule,ruleContext.semantic)&&authoredClockRuleMatches(rule,ruleContext));if(resolution){const wasResolved=clock.resolved,resolvedClock=resolveThreatClockInDirector(director,clock.id);clock=resolvedClock;markAuthoredClockRuleFire(clock,resolution,ruleContext.semantic);if(!wasResolved)events.push({clockId:clock.id,kind:"resolved",ruleId:resolution.id,description:\`威胁时钟“\${clock.name}”按剧本规则解除\`})}}
    clock=authoredClockById(clockId,director)||clock;
    if(!clock.resolved&&!clock.triggered&&clock.active!==false){let budget=clamp(Number(clock.maxAdvancePerEvaluation||1),1,AUTHORED_CLOCK_MAX_ADVANCE_PER_EVALUATION);for(const rule of clock.advanceRules){if(budget<=0)break;clock=authoredClockById(clockId,director)||clock;if(!authoredClockRuleCanFire(clock,rule,ruleContext.semantic)||!authoredClockRuleMatches(rule,ruleContext))continue;const amount=Math.min(budget,clamp(Number(rule.amount||1),1,10)),result=advanceThreatClockInDirector(director,{clockId:clock.id,amount,reason:\`authored:\${rule.id}\`});clock=result.clock;budget-=amount;markAuthoredClockRuleFire(clock,rule,ruleContext.semantic);events.push({clockId:clock.id,kind:result.triggeredNow?"triggered":"advanced",ruleId:rule.id,amount,before:result.before,after:result.clock.current,description:result.description});if(result.triggeredNow)break}}
    clock=authoredClockById(clockId,director)||clock;if(semantic?.id)clock.authoredState.lastSemanticEventId=semantic.id;clock.authoredState.lastEvaluationTurn=context.turn
  }
  if(!events.length)return{changed:false,events:[]};const triggered=events.find(event=>event.kind==="triggered"),resolved=events.find(event=>event.kind==="resolved"),event={id:uid("director-event"),kind:triggered?"clock_triggered":resolved?"authored_clock_resolved":"authored_clock_advanced",turn:context.turn,reason:events.map(item=>\`\${item.clockId}:\${item.ruleId}\`).join(", "),events:deepClone(events)};director.pendingPressure=event;state.runtime.pendingDirectorEvent=event;bumpRevision();const after=progressSemanticSnapshot(),semanticEvent=recordProgressSemantics(before,after,{source:"authored_threat_clock",requestId:null,recordNone:false});addLog("director",\`Authored Threat Clock：\${events.map(item=>item.description).join("；")}\`,{secret:true});return{changed:true,events,semantic:semanticEvent}
}`;
text=text.slice(0,start)+evaluator+text.slice(end);
if(!text.includes("authoredClockLastEvaluationTurn"))throw new Error("director turn gate wiring failed");
write("src/authored-threat-clock.js",text);
console.log("V1510_RELEASE_PATCH:PASS");