"use strict";
const fs=require("fs"),path=require("path");
const root=process.cwd();
const p=(...parts)=>path.join(root,...parts);
function read(file){return fs.readFileSync(file,"utf8")}
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text,"utf8")}
function mustReplace(text,from,to,label){const i=text.indexOf(from);if(i<0)throw new Error(`PATCH_MISS ${label}`);if(text.indexOf(from,i+from.length)>=0)throw new Error(`PATCH_AMBIGUOUS ${label}`);return text.slice(0,i)+to+text.slice(i+from.length)}
function replaceBlock(text,startMarker,endMarker,replacement,label){const start=text.indexOf(startMarker),end=text.indexOf(endMarker,start+startMarker.length);if(start<0||end<0||end<=start)throw new Error(`PATCH_BLOCK_MISS ${label}`);return text.slice(0,start)+replacement+text.slice(end)}

const libraryPath=p("trpg-dm-assistant/src/scenarios/library.js");
let library=read(libraryPath);
library=mustReplace(library,'const APP_VERSION = "1.5.2";','const APP_VERSION = "1.5.3";',"version");
const routeBlock=`const BUILTIN_CLUE_ROUTE_OVERRIDES = ${JSON.stringify({
  "old-footprints":{checks:["old-hall-passive-spot","old-hall-spot"],failureForward:["old-hall-spot"]},
  "old-key":{checks:["old-room-social"],automatic:true,failureForward:["old-room-social"]},
  "old-medicine":{automatic:true},
  "old-ledger":{checks:["old-study-library"],failureForward:["old-study-library"]},
  "old-scratch":{checks:["old-study-spot"],failureForward:["old-study-spot"]},
  "old-blueprint":{checks:["old-archive-library"],failureForward:["old-archive-library"]},
  "old-shipment":{checks:["old-archive-library"],failureForward:["old-archive-library"]},
  "old-notes":{automatic:true},
  "harbor-log":{checks:["harbor-library"],failureForward:["harbor-library"]},
  "harbor-witness":{checks:["harbor-listen","harbor-social"],failureForward:["harbor-listen","harbor-social"]},
  "harbor-crate":{checks:["harbor-spot"],failureForward:["harbor-spot"]},
  "harbor-map":{checks:["harbor-spot"],failureForward:["harbor-spot"]},
  "harbor-keeper-note":{automatic:true},
  "train-map-fragment":{checks:["train-spot"],failureForward:["train-spot"]},
  "train-case":{checks:["train-lock"],failureForward:["train-lock"]},
  "san-index":{checks:["san-library"],failureForward:["san-library"]},
  "san-drug":{checks:["san-library","san-pharmacy"],failureForward:["san-library","san-pharmacy"]},
  "san-transfer":{checks:["san-spot"],failureForward:["san-spot"]},
  "san-protocol":{automatic:true},
  "cinema-ticket":{checks:["cinema-passive-spot","cinema-spot"],failureForward:["cinema-spot"]},
  "cinema-reel-note":{automatic:true},
  "cinema-diary":{checks:["cinema-library"],failureForward:["cinema-library"]}
},null,2)};
function materializeBuiltinClueRoutes(clueId,spec){
  const routes=[];
  for(const checkId of spec.checks||[])routes.push({id:`${clueId}-check-${checkId}`,type:"check",checkId,minimumRank:"regular"});
  if(spec.automatic)routes.push({id:`${clueId}-automatic`,type:"automatic"});
  for(const checkId of spec.failureForward||[])routes.push({id:`${clueId}-failure-forward-${checkId}`,type:"failure_forward",checkId,cost:{tension:1}});
  return routes
}
(function applyBuiltinClueRouteOverrides(){
  for(const scenario of SCENARIO_LIBRARY)for(const chapter of scenario.chapters||[])for(const scene of chapter.scenes||[])for(const node of scene.nodes||[])for(const clue of node.clues||[]){
    const spec=BUILTIN_CLUE_ROUTE_OVERRIDES[clue.id];
    if(spec)clue.acquisitionRoutes=materializeBuiltinClueRoutes(clue.id,spec)
  }
})();

`;
library=mustReplace(library,"const PRESET_SCENARIO = SCENARIO_LIBRARY[0];",routeBlock+"const PRESET_SCENARIO = SCENARIO_LIBRARY[0];","builtin route overrides");
write(libraryPath,library);

const scenarioPath=p("trpg-dm-assistant/src/scenario-engine.js");
let scenario=read(scenarioPath);
const normalizeRoutes=`function normalizeScenarioClueRoutes(scenario){
  for(const node of allScenarioNodes(scenario)){
    const checks=[...(node.mandatoryChecks||[]),...(node.optionalChecks||[])];
    for(const clue of node.clues||[]){
      clue.protected=clue.protected!==false&&clue.hidden!==false;
      let routes=Array.isArray(clue.acquisitionRoutes)?clue.acquisitionRoutes.map(normalizeAcquisitionRoute):[];
      if(!routes.length){
        let candidates=checks.filter(check=>check.type!=="san").map(check=>({check,score:scoreCheckForClue(check,clue)})).sort((a,b)=>b.score-a.score);
        if(candidates.some(x=>x.score>0))candidates=candidates.filter(x=>x.score===candidates[0].score&&x.score>0);else candidates=[];
        routes=candidates.length?candidates.map((item,index)=>normalizeAcquisitionRoute({id:`${clue.id}-check-${index+1}`,type:"check",checkId:item.check.id,minimumRank:item.check.difficulty||"regular"},index)):[normalizeAcquisitionRoute({id:`${clue.id}-automatic`,type:"automatic"},0)];
        if(clue.protected&&candidates.length)for(let index=0;index<candidates.length;index++){const item=candidates[index];routes.push(normalizeAcquisitionRoute({id:`${clue.id}-failure-forward-${index+1}`,type:"failure_forward",checkId:item.check.id,cost:{tension:1}},routes.length))}
      }
      clue.acquisitionRoutes=routes
    }
    for(const check of checks){check.protectedClueIds=(node.clues||[]).filter(clue=>(clue.acquisitionRoutes||[]).some(route=>route.type==="check"&&route.checkId===check.id)).map(clue=>clue.id);if(check.type==="san"&&!check.exposureKey)check.exposureKey=`${node.id}:${check.id||check.reason||"san"}`}
  }
  return scenario
}
`;
scenario=replaceBlock(scenario,"function normalizeScenarioClueRoutes(scenario){","function processedExposure",normalizeRoutes,"normalizeScenarioClueRoutes");
const validateClue=`function validateClueAcquisition(raw,clue,validationContext={}){
  if(!clue?.protected)return{routeId:"unprotected",record:null,quality:"automatic",tensionCost:0};
  const routes=(clue.acquisitionRoutes||[]).map(normalizeAcquisitionRoute),explicitRecordId=asString(raw.sourceCheckRecordId,120),contextualRecordId=asString(validationContext.currentCheckRecordId,120),routeId=asString(raw.sourceRouteId,120),route=routes.find(item=>item.id===routeId),getRecord=recordId=>recordId?state.checkRecords.find(item=>item.id===recordId):null;
  const authorizeCheck=(selectedRoute,recordId,record)=>{
    if(!record)throw new Error(`线索 ${clue.id} 引用的检定记录不存在：${recordId}`);
    if(selectedRoute.checkId&&selectedRoute.checkId!==record.sourceCheckId)throw new Error(`检定记录 ${recordId} 不属于线索 ${clue.id} 的获取路线`);
    if(record.skipped||record.result!==true||!rankSatisfies(record.rank||"regular",selectedRoute.minimumRank))throw new Error(`检定记录 ${recordId} 未达到线索 ${clue.id} 的获取条件`);
    return{routeId:selectedRoute.id,record,quality:clueDiscoveryQuality(record),tensionCost:0}
  };
  const passiveAuthorization=selectedRoute=>{
    if(selectedRoute.type==="automatic")return{routeId:selectedRoute.id,record:null,quality:"automatic",tensionCost:0};
    if(selectedRoute.type==="flag"&&state.campaign.flags?.[selectedRoute.requiredFlag]===true)return{routeId:selectedRoute.id,record:null,quality:"automatic",tensionCost:0};
    if(selectedRoute.type==="clue"&&state.clues.some(item=>item.id===selectedRoute.requiredClueId))return{routeId:selectedRoute.id,record:null,quality:"automatic",tensionCost:0};
    if(selectedRoute.type==="npc"&&state.npcs.some(item=>item.id===selectedRoute.npcId)&&(!selectedRoute.requiredFlag||state.campaign.flags?.[selectedRoute.requiredFlag]===true))return{routeId:selectedRoute.id,record:null,quality:"automatic",tensionCost:0};
    return null
  };
  if(routeId){
    if(!route)throw new Error(`线索 ${clue.id} 不存在获取路线 ${routeId}`);
    if(route.type==="failure_forward"){
      const recordId=explicitRecordId||contextualRecordId,record=getRecord(recordId);
      if(!record)throw new Error(`失败前进路线 ${routeId} 必须引用当前失败或跳过的检定记录`);
      if(route.checkId&&route.checkId!==record.sourceCheckId)throw new Error(`检定记录 ${recordId} 不属于失败前进路线 ${routeId}`);
      if(record.result===true&&!record.skipped)throw new Error(`检定记录 ${recordId} 已成功，不能使用失败前进路线`);
      const quality=clueDiscoveryQuality(record),baseCost=Math.max(1,Number(route.cost?.tension||1)),tensionCost=quality==="fumble"?Math.max(2,baseCost):baseCost;validationContext.failureForwardTension=Math.max(Number(validationContext.failureForwardTension||0),tensionCost);return{routeId,record,quality,tensionCost}
    }
    if(route.type==="check"){
      const recordId=explicitRecordId||contextualRecordId;if(!recordId)throw new Error(`检定路线 ${routeId} 必须引用检定记录`);return authorizeCheck(route,recordId,getRecord(recordId))
    }
    const passive=passiveAuthorization(route);if(passive)return passive;throw new Error(`线索 ${clue.id} 的获取路线 ${routeId} 当前条件未满足`)
  }
  if(explicitRecordId){
    const record=getRecord(explicitRecordId);if(!record)throw new Error(`线索 ${clue.id} 引用的检定记录不存在：${explicitRecordId}`);const matching=routes.find(item=>item.type==="check"&&(!item.checkId||item.checkId===record.sourceCheckId));if(!matching)throw new Error(`检定记录 ${explicitRecordId} 不属于线索 ${clue.id} 的获取路线`);return authorizeCheck(matching,explicitRecordId,record)
  }
  let contextualFailure=null,contextualRecord=null;
  if(contextualRecordId){
    contextualRecord=getRecord(contextualRecordId);
    if(contextualRecord){const matching=routes.find(item=>item.type==="check"&&(!item.checkId||item.checkId===contextualRecord.sourceCheckId));if(matching){if(!contextualRecord.skipped&&contextualRecord.result===true&&rankSatisfies(contextualRecord.rank||"regular",matching.minimumRank))return{routeId:matching.id,record:contextualRecord,quality:clueDiscoveryQuality(contextualRecord),tensionCost:0};contextualFailure={matching,record:contextualRecord}}}
  }
  for(const candidate of routes){const passive=passiveAuthorization(candidate);if(passive)return passive}
  if(contextualFailure)throw new Error(`检定记录 ${contextualRecordId} 未达到线索 ${clue.id} 的获取条件`);
  if(contextualRecord)throw new Error(`检定记录 ${contextualRecordId} 不属于线索 ${clue.id} 的获取路线`);
  throw new Error(`受保护线索 ${clue.id} 缺少有效 sourceCheckRecordId 或 sourceRouteId`)
}
`;
scenario=replaceBlock(scenario,"function validateClueAcquisition(raw,clue,validationContext={}){","function normalizeThreatClock",validateClue,"validateClueAcquisition");
write(scenarioPath,scenario);

const aiPath=p("trpg-dm-assistant/src/ai-protocol.js");
let ai=read(aiPath);
ai=mustReplace(ai,'4. 受保护线索只能通过合法获取路线揭示。revealClue 必须提供 sourceCheckRecordId 或 sourceRouteId。不得仅凭自然语言宣布发现隐藏线索。','4. 受保护线索只能通过合法获取路线揭示。revealClue 必须提供 sourceCheckRecordId 或 sourceRouteId；若使用 automatic/flag/npc/clue 路线，应优先提供对应 sourceRouteId，不要把本轮无关检定记录冒充为线索来源。不得仅凭自然语言宣布发现隐藏线索。',"system clue provenance prompt");
ai=mustReplace(ai,'action_adjudication 若 decision=check，所有变化数组必须为空且不得推进节点/结局。revealClue 必须引用合法 sourceCheckRecordId 或 sourceRouteId。只有实际完成地点切换时才使用 transition_proposal + nodeProposal。','action_adjudication 若 decision=check，所有变化数组必须为空且不得推进节点/结局。revealClue 必须引用合法 sourceCheckRecordId 或 sourceRouteId；automatic/flag/npc/clue 路线使用 sourceRouteId，不要附带无关的 sourceCheckRecordId。只有实际完成地点切换时才使用 transition_proposal + nodeProposal。',"user clue provenance prompt");
write(aiPath,ai);

const v152Path=p("trpg-dm-assistant/build/test-v152-long-session.js");
let v152=read(v152Path);
v152=mustReplace(v152,'test("版本为 v1.5.2",()=>assert.ok(library.includes(\'const APP_VERSION = "1.5.2";\')));','test("版本不低于 v1.5.2",()=>{const match=library.match(/const APP_VERSION = "(\\d+)\\.(\\d+)\\.(\\d+)";/);assert.ok(match);const [,major,minor,patch]=match.map(Number);assert.ok(major>1||(major===1&&minor>5)||(major===1&&minor===5&&patch>=2))});',"v152 version floor");
write(v152Path,v152);

const libraryNow=read(libraryPath),scenarioNow=read(scenarioPath),aiNow=read(aiPath);
if(!libraryNow.includes('const APP_VERSION = "1.5.3";'))throw new Error("VERSION_GUARD_FAILED");
if(!libraryNow.includes('"train-map-fragment": {')&&!libraryNow.includes('"train-map-fragment":{'))throw new Error("TRAIN_ROUTE_SPEC_MISSING");
if(!libraryNow.includes('"train-spot"'))throw new Error("TRAIN_SPOT_ROUTE_MISSING");
if(!scenarioNow.includes('explicitRecordId=asString(raw.sourceCheckRecordId,120)'))throw new Error("PROVENANCE_PRECEDENCE_MISSING");
if(!scenarioNow.includes('type:"failure_forward",checkId:item.check.id'))throw new Error("FAILURE_FORWARD_BINDING_MISSING");
if(!aiNow.includes("不要把本轮无关检定记录冒充为线索来源"))throw new Error("PROMPT_PROVENANCE_GUARD_MISSING");
if(!aiNow.includes("允许本轮 narrative 有内容而 stateChanges=[]、campaignChanges=[]；这不是错误"))throw new Error("NEUTRAL_NARRATIVE_GUARD_MISSING");
console.log("PATCH_V153_DONE");
