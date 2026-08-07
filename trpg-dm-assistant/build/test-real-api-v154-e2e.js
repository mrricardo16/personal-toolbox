"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const assert=require("assert");

const root=path.resolve(__dirname,"..");
const key=String(process.env.TRPG_TEST_API_KEY||"").trim();
const apiUrl=String(process.env.TRPG_TEST_API_URL||"https://api.deepseek.com/chat/completions").trim();
const model=String(process.env.TRPG_TEST_MODEL||"deepseek-v4-flash").trim();
const maxTurns=Math.max(12,Math.min(50,Number(process.env.TRPG_TEST_ROUNDS||30)));
const seed=(Number(process.env.TRPG_E2E_SEED||154)>>>0)||154;
const artifactDir=path.resolve(process.env.TRPG_E2E_ARTIFACT_DIR||path.join(root,"e2e-artifacts"));
if(!key){console.error("REAL_API_V154_E2E:SKIP:NO_KEY");process.exit(2)}

function memoryStorage(){const map=new Map();return{getItem:key=>map.has(String(key))?map.get(String(key)):null,setItem:(key,value)=>map.set(String(key),String(value)),removeItem:key=>map.delete(String(key)),clear:()=>map.clear(),key:index=>Array.from(map.keys())[index]??null,get length(){return map.size}}}
const localStorage=memoryStorage(),sessionStorage=memoryStorage();
let rng=seed;
function nextU32(){rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return rng>>>0}
const deterministicCrypto={getRandomValues(array){for(let i=0;i<array.length;i++)array[i]=nextU32();return array},randomUUID(){return `e2e-${nextU32().toString(16)}-${nextU32().toString(16)}`}};

let apiRequests=0,promptTokens=0,completionTokens=0;
const realFetch=globalThis.fetch;
async function meteredFetch(...args){
  apiRequests++;
  const response=await realFetch(...args);
  try{const data=await response.clone().json();promptTokens+=Number(data?.usage?.prompt_tokens||0);completionTokens+=Number(data?.usage?.completion_tokens||0)}catch{}
  return response;
}

const documentStub={querySelector(){return null},querySelectorAll(){return[]},createElement(){return{className:"",textContent:"",style:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},remove(){},click(){},setAttribute(){}}},body:{appendChild(){}},addEventListener(){}};
const sandbox={
  console,
  setTimeout,clearTimeout,setInterval,clearInterval,
  TextEncoder,TextDecoder,URL,Blob,AbortController,
  fetch:meteredFetch,crypto:deterministicCrypto,
  window:{localStorage,sessionStorage,addEventListener(){},removeEventListener(){}},
  document:documentStub,
  navigator:{userAgent:"trpg-e2e-node"},
  confirm:()=>true,
  alert:()=>{},
  renderAll:()=>{},renderTopbar:()=>{},renderSidebar:()=>{},renderChat:()=>{},renderChatLog:()=>{},renderChatComposer:()=>{},renderSaves:()=>{},
  toast:()=>{},openModal:()=>{},closeModal:()=>{}
};
sandbox.globalThis=sandbox;sandbox.window.document=documentStub;
const context=vm.createContext(sandbox);
const moduleFiles=["scenarios/library.js","state.js","check-engine.js","scenario-engine.js","memory.js","ai-protocol.js","saves.js"];
for(const relative of moduleFiles){const source=fs.readFileSync(path.join(root,"src",relative),"utf8");vm.runInContext(source,context,{filename:`src/${relative}`})}
vm.runInContext(`
  scheduleAutosave=()=>{};
  renderAll=()=>{};renderTopbar=()=>{};renderSidebar=()=>{};renderChat=()=>{};renderChatLog=()=>{};renderChatComposer=()=>{};renderSaves=()=>{};toast=()=>{};
  globalThis.__e2e={
    version:()=>APP_VERSION,
    schema:()=>SCHEMA_VERSION,
    snapshot:()=>deepClone(state),
    configure:(cfg,key)=>{state.config={...state.config,...deepClone(cfg)};writeApiPreferences(state.config);saveApiKey(key,false,{apiUrl:state.config.apiUrl});},
    setCharacter:c=>{state.character=deepClone(c);setPhase(state.scenario?"awaiting_player_action":"character_ready",{force:true});bumpRevision();},
    scenarioById:id=>deepClone(SCENARIO_LIBRARY.find(item=>item.id===id)),
    activateScenario,
    submitPlayerAction,
    resolvePendingCheck,
    confirmNodeProposal,
    rejectNodeProposal,
    retryInitialRequest,
    retryContinuation,
    processCheckQueue,
    serializeSave,
    roundTripSave:()=>{const save=serializeSave();state=normalizeLoadedState(save.state);sanitizeRuntimeAfterLoad();return deepClone(save)},
    addKeeperMarker:marker=>{state.scenario.director={...(state.scenario.director||{}),establishedFacts:[...((state.scenario.director||{}).establishedFacts||[]),marker]};},
    getCurrentNode:()=>deepClone(getCurrentNode()),
    findNode:id=>{const found=findNode(id);return found?deepClone(found.node):null},
    getContextDiagnostics:()=>deepClone(state.runtime.longSessionDiagnostics||null)
  };
`,context,{filename:"e2e-export.js"});
const api=sandbox.__e2e;

function makeCharacter(){
  const attributes={str:55,con:60,siz:60,dex:65,app:50,int:70,pow:65,edu:70};
  const values={spot_hidden:75,psychology:65,library_use:70,law:55,persuade:60,listen:55,mechanical_repair:50,first_aid:55,locksmith:30,occult:30,stealth:45,fighting_brawl:45};
  const defs=JSON.parse(fs.readFileSync(path.join(root,"src/scenarios/library.js"),"utf8").match(/const COC_SKILL_DEFINITIONS = (\[[\s\S]*?\]);\nconst COC_OCCUPATIONS/)[1]);
  const skills=defs.map(def=>{let base=typeof def.base==="number"?def.base:def.base==="half_dex"?Math.floor(attributes.dex/2):def.base==="edu"?attributes.edu:0;return{id:def.id,name:def.name,base,occupationPoints:0,interestPoints:0,value:Number(values[def.id]??base),occupationSkill:["spot_hidden","psychology","library_use","law","art_photography","persuade","credit_rating"].includes(def.id),category:def.category}});
  return{system:"coc7",name:"E2E 调查员",occupation:"私家侦探",occupationId:"private_investigator",occupationFormulaId:"edu2dex2",occupationSkillIds:skills.filter(x=>x.occupationSkill).map(x=>x.id),occupationChoices:["persuade"],age:32,creationMethod:"coc5",attributeTotal:Object.values(attributes).reduce((a,b)=>a+b,0),hp:12,maxHp:12,san:65,maxSan:99,luck:60,attributes,skills,skillPointPools:{occupationTotal:270,occupationSpent:270,interestTotal:140,interestSpent:140,occupationCap:80,nonOccupationCap:60},creationValidation:"complete",background:"受失踪者家属委托调查顾宅。"}
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function snap(){return api.snapshot()}
function mechanicsFingerprint(s){return JSON.stringify({node:s.campaign.currentNodeId,clues:s.clues.map(x=>x.id).sort(),items:s.items.map(x=>[x.id,x.quantity]),statuses:s.statuses.map(x=>x.id),hp:s.character?.hp,san:s.character?.san,flags:s.campaign.flags,progress:s.campaign.directorState?.progress,tension:s.campaign.directorState?.tension,threats:s.campaign.directorState?.activeThreats,leads:(s.campaign.activeLeads||[]).map(x=>[x.id,x.status]),questions:(s.campaign.unresolvedQuestions||[]).map(x=>[x.id,x.status])})}
function invariantSnapshot(s){return{node:s.campaign.currentNodeId,location:s.campaign.currentLocation,clues:s.clues.map(x=>x.id).sort(),npcClaims:(s.npcs||[]).map(n=>[n.id,(n.continuity?.claims||[]).slice()]),checks:s.checkRecords.map(x=>[x.id,x.sourceCheckId,x.total,x.rank,x.result]),flags:s.campaign.flags,progress:s.campaign.directorState?.progress,tension:s.campaign.directorState?.tension,hp:s.character?.hp,san:s.character?.san,revision:s.revision}}
function endingNode(s){return /^结局[:：]/u.test(String(api.getCurrentNode()?.title||""))||/^old-ending-/u.test(String(s.campaign.currentNodeId||""))}

const plans={
  "old-hall":[
    "我先在门内整理湿外套，花一分钟观察大厅的灯光和普通陈设，不主动寻找线索。",
    "我仔细检查大厅地面、档案箱和沈墨可能留下的痕迹。",
    "我询问管家周铭沈墨最后一次出现的时间，并留意他是否在回避问题。",
    "我结束大厅调查，明确前往管家房查看。"
  ],
  "old-servant-room":[
    "我先看看房间整体布置，不翻动任何东西。",
    "我仔细检查湿外套、药瓶、铜钥匙和其他近期使用过的物品。",
    "我温和追问周铭夜里听见的动静，并尝试说服他说明实情、交出有用物品。",
    "我带上已经取得的资料，前往书房继续调查。"
  ],
  "old-study":[
    "我先浏览书桌表面的普通文件和书架排列，不做深入搜索。",
    "我仔细检查书架、墙边移动痕迹和可能存在的暗门机关。",
    "我系统整理残缺账册和通信，追查商会资金流向。",
    "我前往档案储藏室，继续查建筑图和运输记录。"
  ],
  "old-archive":[
    "我先确认档案储藏室的整体布局和资料分类，不急着翻找。",
    "我仔细整理建筑图、运输清单和被撕下的账册页，寻找与地下空间有关的证据。",
    "我根据现有图纸和通道信息，沿维修门进入地下封存区。"
  ],
  "old-cellar":[
    "我先稳住情绪，在原地观察封存区的设备和环境，不贸然触碰。",
    "我搜索地下封存区，寻找沈墨留下的速记、实验记录或能证明他下落的证据。",
    "我确认内侧冷库的位置后打开冷库，寻找并救出沈墨。"
  ],
  "old-rescue":[
    "我先检查沈墨的呼吸、意识和制冷机状态，判断眼前最紧急的问题。",
    "我尝试用机械维修安全关闭过载的制冷机。",
    "我为沈墨做急救，尽量稳定他的生命体征。",
    "我带着沈墨和已经取得的证据离开顾宅。"
  ],
  "old-evidence":[
    "我整理手里的账本、图纸和速记，确认重要证据没有遗漏。",
    "我向管家说明现有证据，尝试说服他作证。",
    "我带着关键证据离开顾宅。"
  ]
};
const nodeStep=new Map();
function nextAction(s){const node=s.campaign.currentNodeId,list=plans[node]||[`我根据目前掌握的信息继续调查当前地点，并优先处理尚未解决的问题。`];const i=nodeStep.get(node)||0;nodeStep.set(node,i+1);return list[Math.min(i,list.length-1)]}

const metrics={version:null,schema:null,maxTurns,seed,playerTurns:0,apiRequests:0,checks:0,checkSuccesses:0,checkFailures:0,clues:0,nodeTransitions:0,neutralTurns:0,saveReloads:0,retries:0,protocolFailures:0,transactionRejects:0,secretLeaks:0,duplicatePlayerMessages:0,reachedEnding:false,endingNode:null,maxDroppedRecent:0,maxContextChars:0,promptTokens:0,completionTokens:0};
const transcript=[];
const marker="KEEPER_E2E_SECRET_154";
let savedOnce=false;

async function settle(){
  for(let guard=0;guard<24;guard++){
    await sleep(20);
    const s=snap(),phase=s.runtime.phase;
    if(s.runtime.summaryInProgress||s.runtime.activeRequestId||["requesting_ai","rolling","requesting_ai_continuation"].includes(phase)){await sleep(150);continue}
    if(phase==="awaiting_check"&&s.runtime.pendingCheck){await api.resolvePendingCheck();continue}
    if(phase==="awaiting_node_confirmation"&&s.runtime.pendingNodeProposal){api.confirmNodeProposal();continue}
    if(phase==="error"){
      const failed=s.runtime.failedRequest||{},beforePlayers=s.messages.filter(x=>x.role==="player").length;metrics.protocolFailures++;if(failed.errorCode==="STATE_TRANSACTION_REJECTED"||String(failed.errorCode||"").includes("LOCATION")||String(failed.errorCode||"").includes("CLUE"))metrics.transactionRejects++;
      if(metrics.retries>=2)throw new Error(`未恢复的产品错误：${failed.errorCode||"UNKNOWN"} ${failed.errorMessage||s.runtime.lastError||""}`);
      metrics.retries++;
      if(failed.kind==="continuation")await api.retryContinuation();else await api.retryInitialRequest();
      const afterPlayers=snap().messages.filter(x=>x.role==="player").length;if(afterPlayers!==beforePlayers)metrics.duplicatePlayerMessages+=Math.abs(afterPlayers-beforePlayers);continue
    }
    if(phase==="awaiting_player_action"||phase==="campaign_ended"||phase==="awaiting_ending_confirmation")return
    await sleep(80)
  }
  throw new Error(`状态机未在保护步数内稳定：${snap().runtime.phase}`)
}

(async()=>{
  metrics.version=api.version();metrics.schema=api.schema();
  assert.equal(metrics.version,"1.5.3","E2E 基线必须从当前 v1.5.3 开始");assert.equal(metrics.schema,8);
  api.configure({apiUrl,model,temperature:0.35,timeoutMs:120000,contextCharBudget:24000,loreCharBudget:6000,kpDebug:false},key);
  api.setCharacter(makeCharacter());
  const scenario=api.scenarioById("scenario-old-house");assert.ok(scenario,"缺少旧宅失踪案");api.activateScenario(scenario);api.addKeeperMarker(marker);await settle();

  for(let turn=1;turn<=maxTurns;turn++){
    let before=snap();if(endingNode(before)){metrics.reachedEnding=true;metrics.endingNode=before.campaign.currentNodeId;break}
    if(before.runtime.phase!=="awaiting_player_action")await settle();before=snap();
    const action=nextAction(before),beforeFingerprint=mechanicsFingerprint(before),beforeChecks=before.checkRecords.length,beforeClues=new Set(before.clues.map(x=>x.id)),beforeNode=before.campaign.currentNodeId,beforeAiCount=before.messages.filter(x=>x.role==="ai").length;
    const entry={turn,nodeBefore:beforeNode,action,phaseBefore:before.runtime.phase};metrics.playerTurns++;
    const ok=await api.submitPlayerAction(action);if(ok===false&&snap().runtime.phase!=="error")throw new Error(`第 ${turn} 轮请求返回 false 但未进入 error`);await settle();
    let after=snap();
    const newChecks=after.checkRecords.slice(beforeChecks);metrics.checks+=newChecks.length;for(const r of newChecks){if(r.result===true)metrics.checkSuccesses++;else if(r.result===false||r.rank==="failure"||r.rank==="fumble")metrics.checkFailures++}
    const newClues=after.clues.filter(x=>!beforeClues.has(x.id));metrics.clues+=newClues.length;if(after.campaign.currentNodeId!==beforeNode)metrics.nodeTransitions++;
    const afterFingerprint=mechanicsFingerprint(after);const newAi=after.messages.filter(x=>x.role==="ai").slice(beforeAiCount);if(beforeFingerprint===afterFingerprint&&newAi.some(x=>String(x.content||"").trim()))metrics.neutralTurns++;
    const aiText=newAi.map(x=>x.content).join("\n");if(aiText.includes(marker))metrics.secretLeaks++;
    const diag=after.runtime.longSessionDiagnostics||{};metrics.maxDroppedRecent=Math.max(metrics.maxDroppedRecent,Number(diag.droppedRecent||0));const envelope=after.runtime.lastContextEnvelope;if(envelope)metrics.maxContextChars=Math.max(metrics.maxContextChars,JSON.stringify(envelope).length);
    entry.nodeAfter=after.campaign.currentNodeId;entry.phaseAfter=after.runtime.phase;entry.checks=newChecks.map(r=>({id:r.id,sourceCheckId:r.sourceCheckId,total:r.total,rank:r.rank,result:r.result,visibility:r.visibility}));entry.clues=newClues.map(c=>({id:c.id,name:c.name,quality:c.discoveryQuality||null,sourceCheckRecordId:c.sourceCheckRecordId||null,sourceRouteId:c.sourceRouteId||null}));entry.progress=[before.campaign.directorState?.progress,after.campaign.directorState?.progress];entry.tension=[before.campaign.directorState?.tension,after.campaign.directorState?.tension];entry.narrative=newAi.map(x=>String(x.content||"").slice(0,1200));transcript.push(entry);

    if(!savedOnce&&turn>=8&&after.runtime.phase==="awaiting_player_action"){
      const invariantBefore=invariantSnapshot(after);api.roundTripSave();await settle();const restored=snap(),invariantAfter=invariantSnapshot(restored);delete invariantBefore.revision;delete invariantAfter.revision;assert.deepStrictEqual(invariantAfter,invariantBefore,"存档往返后核心状态不一致");metrics.saveReloads++;savedOnce=true;after=restored
    }
    if(endingNode(after)){metrics.reachedEnding=true;metrics.endingNode=after.campaign.currentNodeId;break}
  }

  const final=snap();metrics.apiRequests=apiRequests;metrics.promptTokens=promptTokens;metrics.completionTokens=completionTokens;metrics.reachedEnding=metrics.reachedEnding||endingNode(final);metrics.endingNode=metrics.endingNode|| (metrics.reachedEnding?final.campaign.currentNodeId:null);
  const playerMessageCount=final.messages.filter(x=>x.role==="player").length;if(playerMessageCount!==metrics.playerTurns)metrics.duplicatePlayerMessages+=Math.abs(playerMessageCount-metrics.playerTurns);
  if(final.messages.filter(x=>x.role==="ai").some(x=>String(x.content||"").includes(marker)))metrics.secretLeaks++;

  fs.mkdirSync(artifactDir,{recursive:true});
  const report={generatedAt:new Date().toISOString(),metrics,final:{phase:final.runtime.phase,nodeId:final.campaign.currentNodeId,location:final.campaign.currentLocation,clues:final.clues.map(x=>({id:x.id,name:x.name,quality:x.discoveryQuality||null})),checkCount:final.checkRecords.length,progress:final.campaign.directorState?.progress,tension:final.campaign.directorState?.tension,hp:final.character?.hp,san:final.character?.san},transcript};
  fs.writeFileSync(path.join(artifactDir,"v154-e2e-report.json"),JSON.stringify(report,null,2),"utf8");
  const md=["# v1.5.4 Real API E2E Playtest","",`- Version: ${metrics.version} / Schema ${metrics.schema}`,`- Player turns: ${metrics.playerTurns} / max ${metrics.maxTurns}`,`- API requests: ${metrics.apiRequests}`,`- Checks: ${metrics.checks} (success ${metrics.checkSuccesses}, failure ${metrics.checkFailures})`,`- New clues: ${metrics.clues}`,`- Node transitions: ${metrics.nodeTransitions}`,`- Neutral turns: ${metrics.neutralTurns}`,`- Save/reload: ${metrics.saveReloads}`,`- Recovery retries: ${metrics.retries}`,`- Protocol failures encountered: ${metrics.protocolFailures}`,`- Transaction rejects: ${metrics.transactionRejects}`,`- Secret leaks: ${metrics.secretLeaks}`,`- Duplicate player messages: ${metrics.duplicatePlayerMessages}`,`- Ending reached: ${metrics.reachedEnding} (${metrics.endingNode||"-"})`,`- Prompt tokens: ${metrics.promptTokens}`,`- Completion tokens: ${metrics.completionTokens}`,"",`Final node: ${final.campaign.currentLocation} (${final.campaign.currentNodeId})`].join("\n");
  fs.writeFileSync(path.join(artifactDir,"v154-e2e-report.md"),md,"utf8");

  console.log(`REAL_API_V154_E2E_SUMMARY ${Object.entries(metrics).map(([k,v])=>`${k}=${v}`).join(" ")}`);
  assert.equal(metrics.secretLeaks,0,"主持秘密标记发生泄露");
  assert.equal(metrics.duplicatePlayerMessages,0,"玩家消息出现重复");
  assert.ok(metrics.saveReloads>=1,"没有完成存档/恢复验证");
  assert.ok(metrics.checks>=2,"完整案件未覆盖足够检定");
  assert.ok(metrics.clues>=2,"完整案件未获得足够线索");
  assert.ok(metrics.nodeTransitions>=3,"完整案件地点推进不足");
  assert.ok(metrics.reachedEnding,`在 ${maxTurns} 轮内未抵达结局，最终节点 ${final.campaign.currentNodeId}`);
  assert.notEqual(final.runtime.phase,"error","最终状态停在 error");
  console.log("REAL_API_V154_E2E:PASS");
})().catch(error=>{
  metrics.apiRequests=apiRequests;metrics.promptTokens=promptTokens;metrics.completionTokens=completionTokens;
  try{fs.mkdirSync(artifactDir,{recursive:true});fs.writeFileSync(path.join(artifactDir,"v154-e2e-failure.json"),JSON.stringify({generatedAt:new Date().toISOString(),error:{name:error.name,message:error.message,stack:error.stack},metrics,state:(()=>{try{const s=snap();return{phase:s.runtime.phase,failedRequest:s.runtime.failedRequest,node:s.campaign.currentNodeId,location:s.campaign.currentLocation,clues:s.clues.map(x=>x.id),checks:s.checkRecords.slice(-8),revision:s.revision}}catch{return null}})(),transcript},null,2),"utf8")}catch{}
  console.error(`REAL_API_V154_E2E:FAIL ${error.stack||error.message}`);process.exit(1)
});
