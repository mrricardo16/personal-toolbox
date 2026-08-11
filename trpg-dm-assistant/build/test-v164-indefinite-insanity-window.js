"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert"),{webcrypto}=require("crypto"),{TextEncoder,TextDecoder}=require("util");
const root=path.resolve(__dirname,"..");
const files=["scenarios/library.js","state.js","check-engine.js","scenario-engine.js","case-integrity.js","memory.js","ai-protocol.js","player-action-guard.js","interaction-availability.js","saves.js","api-response-resilience.js","progress-semantics.js","authored-threat-clock.js","npc-knowledge-boundary.js","ending-resolution-gate.js","coc-resolution-engine.js","coc-consequence-contract.js","failure-forward-cost-engine.js","san-loss-resolution.js","indefinite-insanity-window.js"];
function storage(){const map=new Map();return{getItem:k=>map.has(String(k))?map.get(String(k)):null,setItem:(k,v)=>map.set(String(k),String(v)),removeItem:k=>map.delete(String(k)),clear:()=>map.clear(),key:i=>Array.from(map.keys())[i]??null,get length(){return map.size}}}
const localStorage=storage(),sessionStorage=storage();
const sandbox={Object,Array,JSON,Map,Set,console,crypto:webcrypto,TextEncoder,TextDecoder,URL,AbortController,Blob,structuredClone,fetch:async()=>{throw new Error("fetch not expected")},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},window:{localStorage,sessionStorage,addEventListener(){}},document:{addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},createElement(){return{className:"",textContent:"",innerHTML:"",value:"",checked:false,disabled:false,style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},remove(){},click(){},insertAdjacentHTML(){},setAttribute(){},removeAttribute(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},scrollHeight:0,scrollTop:0}},body:{appendChild(){}}},navigator:{clipboard:{writeText:async()=>{}}},confirm:()=>false,alert(){},renderAll(){},renderTopbar(){},renderSidebar(){},renderChat(){},renderChatLog(){},renderChatComposer(){},renderSaves(){},toast(){}};sandbox.globalThis=sandbox;
const source=files.map(file=>fs.readFileSync(path.join(root,"src",file),"utf8")).join("\n\n")+`\n;scheduleAutosave=()=>{};maybeAutoSummarize=()=>{};renderAll=()=>{};renderTopbar=()=>{};renderSidebar=()=>{};renderChat=()=>{};renderChatLog=()=>{};renderChatComposer=()=>{};renderSaves=()=>{};toast=()=>{};
function __character(san=60){return{system:"coc7",name:"Window Investigator",hp:12,maxHp:12,san,maxSan:99,luck:50,attributes:{str:50,con:60,siz:60,dex:60,app:50,int:70,pow:60,edu:70},skills:[{id:"spot_hidden",name:"侦查",value:60}]}}
function __ready(san=60){state=makeInitialState();state.character=__character(san);activateScenario(deepClone(SCENARIO_LIBRARY.find(x=>x.id==="scenario-old-house")));globalThis.__v164StructuredCalls=0;requestStructuredAiJson=async function(messages,meta){globalThis.__v164StructuredCalls++;const obj={protocolVersion:"1.3",requestId:meta.requestId,baseRevision:meta.baseRevision,decision:"resolution",narrative:"你仍能继续行动。",check:null,stateChanges:[],campaignChanges:[],locationEffect:{type:"stay",targetNodeId:null},nodeProposal:null,endingProposal:null,actionSuggestions:[]};return{raw:JSON.stringify(obj),parsed:validateAiResponse(obj,meta)}};return deepClone(state)}
function __record(loss,id="san-v164"){return{id,requestId:"san-req",createdAt:nowIso(),system:"coc7",type:"san",label:"理智检定",expression:"1d100",rawRolls:[80],modifier:0,total:80,target:60,difficulty:"regular",difficultyTarget:60,result:false,rank:"failure",mandatory:true,visibility:"public",hiddenFromPlayer:false,trigger:"ai",origin:"ai",sourceCheckId:"san-source",skipped:false,sourceNodeId:state.campaign.currentNodeId,reason:"恐怖刺激",purpose:"恐怖刺激",protectedClueIds:[],exposureKey:"v164-"+id,sanLoss:{amount:Number(loss),expression:String(loss),rawRolls:[]}}}
function __applySanRecord(loss,id){state.character.san=Math.max(0,state.character.san-Number(loss));const r=__record(loss,id);state.checkRecords.push(r);ensureSanLossResolution(r,{roller:()=>99});return deepClone(r)}
function __normalize(character,newCharacter=false){return deepClone(normalizeSanityState(character,{newCharacter}))}
function __threshold(value){return indefiniteInsanityThreshold(value)}
function __window(){return deepClone(indefiniteWindowSnapshot(state.character))}
function __condition(){return deepClone(indefiniteConditionSnapshot(state.character))}
function __events(){return deepClone(indefiniteLossEventsSnapshot(state.character))}
function __recordLoss(amount,sourceId="manual"){return deepClone(recordIndefiniteSanLoss(state.character,amount,{source:"test",sourceId}))}
function __resetWindow(source="scenario",sourceId="test"){return deepClone(beginIndefiniteInsanityWindow(state.character,{source,sourceId}))}
function __transactionSan(delta,requestId="tx-v164"){const parsed={protocolVersion:"1.3",requestId,baseRevision:state.revision,decision:"resolution",narrative:"继续",check:null,stateChanges:[{operation:"adjustSan",amount:Number(delta)}],campaignChanges:[],locationEffect:{type:"stay",targetNodeId:null},nodeProposal:null,endingProposal:null,actionSuggestions:[]};const tx=prepareAiTransaction(parsed);commitAiTransaction(tx,requestId);return deepClone(state)}
function __preparedSan(delta,requestId="prepared-v164"){const prepared=prepareStateChanges([{operation:"adjustSan",amount:Number(delta)}],[],{});commitPreparedChanges(prepared,requestId);return deepClone(state)}
function __addSecondChapter(){const node={id:"node-v164-chapter-2",title:"第二章节点",background:"",goals:[],clues:[],npcs:[],mandatoryChecks:[],optionalChecks:[],exits:[]};state.scenario.chapters.push({id:"chapter-v164-2",title:"第二章",scenes:[{id:"scene-v164-2",title:"第二章场景",nodes:[node]}]});return node.id}
function __enter(nodeId){enterNode(nodeId);return deepClone(state)}
function __setSanAndReactivate(value){state.character.san=Number(value);const scenario=deepClone(state.scenario);activateScenario(scenario);return deepClone(state)}
function __setTemporary(value){state.character.sanityState.temporary=deepClone(value);return deepClone(state)}
function __legacy(){state=makeInitialState();state.character=__character(42);state.character.sanityState={version:"1.0",authority:"browser_coc_sanity",baselineSan:60,baselineSource:"creation",indefiniteTrackingReady:false,temporary:null,history:[]};return deepClone(normalizeSanityState(state.character))}
function __snapshot(){return deepClone(sanityStateSnapshot(state.character))}
function __context(){return deepClone(sanResolutionContext())}
function __diagnostic(){return deepClone(buildDiagnosticPackage())}
function __prompt(){return buildSystemPrompt()}
function __revision(){return state.revision}
function __state(){return deepClone(state)}
async function __continuation(loss,id){state.character.san=Math.max(0,state.character.san-loss);const r=__record(loss,id);state.checkRecords.push(r);await requestContinuation(r,{secret:false});return{calls:globalThis.__v164StructuredCalls,record:deepClone(r),state:deepClone(state)}}
globalThis.__test={APP_VERSION,SCHEMA_VERSION,AI_PROTOCOL_VERSION,INDEFINITE_INSANITY_WINDOW_VERSION,INDEFINITE_INSANITY_WINDOW_AUTHORITY,ready:__ready,threshold:__threshold,window:__window,condition:__condition,events:__events,recordLoss:__recordLoss,resetWindow:__resetWindow,applySanRecord:__applySanRecord,normalize:__normalize,transactionSan:__transactionSan,preparedSan:__preparedSan,addSecondChapter:__addSecondChapter,enter:__enter,setSanAndReactivate:__setSanAndReactivate,setTemporary:__setTemporary,legacy:__legacy,snapshot:__snapshot,context:__context,diagnostic:__diagnostic,prompt:__prompt,revision:__revision,state:__state,continuation:__continuation};`;
vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:"v164-indefinite-insanity-window-runtime.js"});
const api=sandbox.__test;let passed=0;async function test(name,fn){await fn();passed++;console.log(`PASS ${name}`)}
(async()=>{
await test("v1.6.4 Indefinite Insanity Window 模块加载且 Schema/协议稳定",async()=>{assert.equal(api.INDEFINITE_INSANITY_WINDOW_VERSION,"1.0");assert.equal(api.INDEFINITE_INSANITY_WINDOW_AUTHORITY,"browser_coc_sanity_window");assert.equal(api.SCHEMA_VERSION,8);assert.equal(api.AI_PROTOCOL_VERSION,"1.3")});
await test("Starting SAN 的 1/5 阈值向下取整",async()=>{assert.equal(api.threshold(60),12);assert.equal(api.threshold(63),12);assert.equal(api.threshold(99),19)});
await test("新角色建立 creation 权威窗口",async()=>{const c={system:"coc7",name:"New",san:63};const s=api.normalize(c,true);assert.equal(s.indefiniteTrackingReady,true);assert.equal(s.indefiniteWindow.source,"creation");assert.equal(s.indefiniteWindow.baselineSan,63);assert.equal(s.indefiniteWindow.thresholdLoss,12)});
await test("v1.6.3 legacy 状态不会被伪造为可累计窗口",async()=>{const s=api.legacy();assert.equal(s.indefiniteTrackingReady,false);assert.equal(s.indefiniteWindow,null)});
api.ready(60);
await test("启用剧本自动建立 scenario Starting SAN 窗口",async()=>{const w=api.window();assert.equal(w.source,"scenario");assert.equal(w.baselineSan,60);assert.equal(w.thresholdLoss,12);assert.equal(w.accumulatedLoss,0)});
await test("低于 1/5 累计损失不会触发不定期疯狂",async()=>{api.recordLoss(11,"below");assert.equal(api.window().accumulatedLoss,11);assert.equal(api.window().triggered,false);assert.equal(api.condition(),null)});
api.ready(60);
await test("累计损失恰好达到 1/5 时触发",async()=>{const out=api.recordLoss(12,"exact");assert.equal(out.justTriggered,true);assert.equal(api.window().triggered,true);assert.equal(api.condition().active,true);assert.equal(api.condition().thresholdLoss,12)});
api.ready(60);
await test("多次 SAN 损失可跨事件累计达到阈值",async()=>{api.recordLoss(4,"a");api.recordLoss(3,"b");const out=api.recordLoss(5,"c");assert.equal(out.accumulatedLoss,12);assert.equal(out.justTriggered,true);assert.equal(api.events().length,3)});
api.ready(60);
await test("同一来源事件重复提交不会双计",async()=>{api.recordLoss(5,"same");const second=api.recordLoss(5,"same");assert.equal(second.deduplicated,true);assert.equal(api.window().accumulatedLoss,5);assert.equal(api.events().length,1)});
api.ready(60);
await test("同一 SAN check record 重试不重复累计",async()=>{api.applySanRecord(5,"check-same");const before=api.window().accumulatedLoss;api.applySanRecord(0,"other");const r=api.state().checkRecords.find(x=>x.id==="check-same");sandbox.ensureSanLossResolution(r,{roller:()=>99});assert.equal(api.window().accumulatedLoss,before);assert.equal(api.events().filter(x=>x.sourceId==="check-same").length,1)});
api.ready(60);
await test("SAN 检定损失进入正式累计窗口",async()=>{const r=api.applySanRecord(4,"check-1");assert.equal(api.window().accumulatedLoss,4);assert.equal(r.sanResolution.indefiniteInsanity.evaluated,true);assert.equal(r.sanResolution.indefiniteInsanity.trackingReady,true)});
api.ready(60);
await test("SAN 恢复不会倒扣累计损失",async()=>{api.recordLoss(8,"loss");api.transactionSan(3,"heal");assert.equal(api.state().character.san,63);assert.equal(api.window().accumulatedLoss,8)});
api.ready(60);
await test("普通 AI transaction 的 canonical SAN 下降进入累计窗口",async()=>{const s=api.transactionSan(-4,"tx-loss");assert.equal(s.character.san,56);assert.equal(s.character.sanityState.indefiniteWindow.accumulatedLoss,4);assert.equal(s.character.sanityState.indefiniteLossEvents[0].source,"ai_transaction")});
api.ready(60);
await test("browser prepared changes 的 SAN 下降进入累计窗口",async()=>{const s=api.preparedSan(-3,"prepared-loss");assert.equal(s.character.san,57);assert.equal(s.character.sanityState.indefiniteWindow.accumulatedLoss,3);assert.equal(s.character.sanityState.indefiniteLossEvents[0].source,"browser_prepared_changes")});
api.ready(60);
await test("正向 adjustSan 不生成损失事件",async()=>{api.transactionSan(5,"positive");assert.equal(api.window().accumulatedLoss,0);assert.equal(api.events().length,0)});
api.ready(60);
await test("transaction 累计达到阈值也能触发不定期疯狂",async()=>{api.transactionSan(-7,"tx-a");api.transactionSan(-5,"tx-b");assert.equal(api.window().accumulatedLoss,12);assert.equal(api.condition().active,true)});
api.ready(60);
await test("触发后继续损失不会重复创建 active condition",async()=>{api.recordLoss(12,"trigger");const first=api.condition();api.recordLoss(3,"later");const second=api.condition();assert.equal(second.sourceEventId,first.sourceEventId);assert.equal(second.triggeredAt,first.triggeredAt);assert.equal(api.window().accumulatedLoss,15)});
api.ready(60);
await test("新窗口不会偷偷解除既有不定期疯狂",async()=>{api.recordLoss(12,"trigger");const condition=api.condition();api.resetWindow("chapter","chapter-next");assert.equal(api.window().accumulatedLoss,0);assert.equal(api.condition().active,true);assert.equal(api.condition().sourceEventId,condition.sourceEventId)});
api.ready(60);
await test("同章节普通节点切换不重置窗口",async()=>{api.recordLoss(4,"before-node");const firstChapter=api.state().campaign.currentChapterId,firstNode=api.state().campaign.currentNodeId;const node=api.state().scenario.chapters[0].scenes[0].nodes.find(n=>n.id!==firstNode);if(node){api.enter(node.id);assert.equal(api.state().campaign.currentChapterId,firstChapter);assert.equal(api.window().accumulatedLoss,4)}else assert(true)});
api.ready(60);
await test("真实跨章节 enterNode 自动按当前 SAN 重置窗口",async()=>{api.recordLoss(4,"before-chapter");const id=api.addSecondChapter();api.enter(id);const w=api.window();assert.equal(w.source,"chapter");assert.equal(w.sourceId,"chapter-v164-2");assert.equal(w.baselineSan,60);assert.equal(w.accumulatedLoss,0)});
api.ready(60);
await test("scenario 重新启用使用当时 Current SAN 作为新 Starting SAN",async()=>{api.recordLoss(5,"pre-reset");api.setSanAndReactivate(55);assert.equal(api.window().baselineSan,55);assert.equal(api.window().thresholdLoss,11);assert.equal(api.window().accumulatedLoss,0)});
api.ready(60);
await test("temporary insanity 与 indefinite window 可共存",async()=>{const r=api.applySanRecord(12,"both");assert(r.sanResolution);api.setTemporary({active:true,durationHours:3});api.recordLoss(0,"noop");assert.equal(api.snapshot().temporary.active,true);assert.equal(api.condition().active,true)});
api.ready(60);
await test("窗口事件历史固定最多 80 条",async()=>{for(let i=0;i<85;i++)api.recordLoss(1,`e-${i}`);const events=api.events();assert.equal(events.length,80);assert.equal(events[0].sourceId,"e-5");assert.equal(events.at(-1).sourceId,"e-84")});
api.ready(60);
await test("sanityStateSnapshot 纯读取不推进 revision",async()=>{const before=api.revision(),json=JSON.stringify(api.state().character.sanityState);api.snapshot();assert.equal(api.revision(),before);assert.equal(JSON.stringify(api.state().character.sanityState),json)});
await test("sanResolutionContext 纯读取并暴露 browser window authority",async()=>{const before=api.revision(),ctx=api.context();assert.equal(ctx.indefiniteInsanity.implemented,true);assert.equal(ctx.indefiniteInsanity.authority,"browser_coc_sanity_window");assert.equal(ctx.indefiniteInsanity.trackingReady,true);assert.equal(api.revision(),before)});
await test("diagnostics 读取包含窗口且不修改 canonical state",async()=>{const before=JSON.stringify(api.state()),pack=api.diagnostic();assert(pack.sanLossResolution.indefiniteInsanity);assert.equal(JSON.stringify(api.state()),before)});
await test("系统提示禁止 AI 修改累计与自行解除不定期疯狂",async()=>{const prompt=api.prompt();assert(prompt.includes("Indefinite Insanity Window"));assert(prompt.includes("不得修改、重置、减少累计损失"));assert(prompt.includes("不得自行解除"));assert(prompt.includes("继续正常玩家交互"))});
api.ready(60);
await test("SAN continuation 本地窗口结算不增加额外 API round trip",async()=>{const out=await api.continuation(4,"continuation-v164");assert.equal(out.calls,1);assert.equal(out.state.character.sanityState.indefiniteWindow.accumulatedLoss,4);assert.equal(out.record.sanResolution.indefiniteInsanity.evaluated,true)});
await test("生产构建在 SAN Loss Resolution 后加载 Indefinite Insanity Window",async()=>{const build=fs.readFileSync(path.join(root,"build/build-single-html.js"),"utf8");assert(build.indexOf('"san-loss-resolution.js"')<build.indexOf('"indefinite-insanity-window.js"'))});
await test("single HTML verifier 要求 Indefinite Insanity Window 正式模块",async()=>{const verify=fs.readFileSync(path.join(root,"build/verify-single-html.js"),"utf8");assert(verify.includes('src/indefinite-insanity-window.js'));assert(verify.includes('INDEFINITE_INSANITY_WINDOW_VERSION'))});
console.log(`V164_INDEFINITE_INSANITY_WINDOW_TESTS:${passed}:PASS`)
})().catch(error=>{console.error("V164_INDEFINITE_INSANITY_WINDOW_FAILURE:"+(error?.stack||error));process.exitCode=1});