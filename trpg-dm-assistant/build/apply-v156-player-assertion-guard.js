"use strict";

const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const repoRoot=path.resolve(root,"..");

function read(rel){return fs.readFileSync(path.join(repoRoot,rel),"utf8").replace(/\r\n/g,"\n")}
function write(rel,content){const file=path.join(repoRoot,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,String(content).replace(/\r\n/g,"\n"),"utf8")}
function replaceOnce(rel,from,to){const source=read(rel);const count=source.split(from).length-1;if(count!==1)throw new Error(rel+": expected exactly one replacement target, found "+count+" for "+JSON.stringify(from));write(rel,source.replace(from,to))}

const guardModule=[
'/* 玩家行动权威边界：玩家只能声明意图，不能用自然语言直接写入世界结果。 */',
'const PLAYER_ACTION_GUARD_VERSION="1.0";',
'const PLAYER_ACTION_CHAIN_SPLIT=/(?:然后|之后|随后|接着|紧接着|成功后|完成后|找到后|拿到后|打开后|打死后|击倒后|说服后|再(?=(?:去|前往|进入|离开|返回|拿|取|捡|搜|找|查|看|打开|解锁|攻击|射击|杀|问|说|调查|检查))|并且|并(?=(?:去|前往|进入|离开|返回|拿|取|捡|搜|找|查|看|打开|解锁|攻击|射击|杀|问|说|调查|检查)))/u;',
'const PLAYER_ACTION_OPINION_MARKERS=/(?:我觉得|我认为|我怀疑|我猜|可能|也许|或许|是不是|是否|如果|假如|试着|尝试|想要|打算|准备|计划)/u;',
'',
'function playerGuardNormalize(value){return String(value||"").toLowerCase().replace(/[\\s，。！？；：、,.!?;:\\-—_（）()【】\[\]“”\"\'的了着过]/gu,"")}',
'function playerGuardEscape(value){return String(value||"").replace(/[.*+?^${}()|[\\]\\]/g,"\\\\$&")}',
'function playerGuardCleanTarget(value){let text=asString(value,180).trim();text=text.split(PLAYER_ACTION_CHAIN_SPLIT)[0].trim();text=text.replace(/^(?:一个|那个|这个|那扇|这扇|那间|这间|所谓的|目标是|就是)/u,"").trim();return asString(text,120)}',
'function playerActionGuardClauses(action){const raw=asString(action,4000).replace(/\\r/g,"").trim();if(!raw)return[];const clauses=[];for(const sentence of raw.split(/[\\n。！？；]+/u)){for(const part of sentence.split(PLAYER_ACTION_CHAIN_SPLIT)){const clean=part.replace(/^[，、,\\s]+|[，、,\\s]+$/gu,"").trim();if(clean)clauses.push(asString(clean,500))}}return clauses.slice(0,12)}',
'function classifyPlayerActionStep(step){const text=String(step||"");if(!text)return"other";if(/(?:结案|结束调查|提交证据|报警收网|完成仪式|终止仪式|解决事件|离开案件)/u.test(text))return"resolve";if(/(?:攻击|开枪|射击|砍|刺|打|杀|击倒|制服|干掉|搏斗)/u.test(text))return"attack";if(/(?:说服|询问|问他|问她|交涉|威胁|恐吓|套话|审问|对话|告诉他|告诉她)/u.test(text))return"social";if(/(?:拿|取|捡|拾|收起|拿走|获得|得到|带走)/u.test(text))return"acquire";if(/(?:打开|解锁|撬开|破坏.*门|砸开|推开.*门|拉开.*门)/u.test(text))return"open";if(/(?:找|搜|调查|查看|检查|观察|侦查|搜索|翻找|查阅|确认|识破|研究)/u.test(text))return"investigate";if(/(?:进入|前往|去|走向|离开|返回|抵达|来到|上楼|下楼|过去|出去|进去)/u.test(text))return"move";if(/(?:等待|休息|睡|停留|什么都不做)/u.test(text))return"wait";return"other"}',
'function playerGuardPushAssertion(list,type,target,source){const clean=playerGuardCleanTarget(target);if(!clean)return;const key=type+"|"+playerGuardNormalize(clean);if(list.some(item=>item.key===key))return;list.push({key,type,target:clean,source:asString(source,240)})}',
'function extractPlayerActionAssertions(action){const raw=asString(action,4000),assertions=[];const patterns=[',
'  ["discovery",/(?:我|调查员|角色)?(?:已经|已|直接|现在)?(?:找到了|发现了|查到了|确认了|识破了)([^，。！？；\\n]{1,100})/gu],',
'  ["acquisition",/(?:我|调查员|角色)?(?:已经|已|直接|现在)?(?:拿到了|得到了|获得了|捡到了|拿走了|取得了)([^，。！？；\\n]{1,100})/gu],',
'  ["movement",/(?:我|调查员|角色)?(?:已经|已|直接|现在)?(?:进入了|走进了|到了|抵达了|去了|来到了|离开了)([^，。！？；\\n]{1,100})/gu],',
'  ["open",/(?:我|调查员|角色)?(?:已经|已|直接|现在)?(?:打开了|解锁了|撬开了|砸开了)([^，。！？；\\n]{1,100})/gu],',
'  ["defeat",/(?:我|调查员|角色)?(?:已经|已|直接|现在)?(?:杀死了|杀了|干掉了|击倒了|制服了|打败了)([^，。！？；\\n]{1,100})/gu],',
'  ["knowledge",/(?:我|调查员|角色)?(?:已经|已|直接|现在)?(?:知道了|明白了|查明了)([^，。！？；\\n]{1,100})/gu]',
'];',
'for(const pair of patterns){const type=pair[0],regex=pair[1];for(const match of raw.matchAll(regex))playerGuardPushAssertion(assertions,type,match[1],match[0])}',
'const npcPattern=/(.{1,16}?)(?:告诉我|跟我说|对我说|承认|坦白|交代)([^，。！？；\\n]{1,100})/gu;for(const match of raw.matchAll(npcPattern)){if(!PLAYER_ACTION_OPINION_MARKERS.test(match[0]))playerGuardPushAssertion(assertions,"npc_claim",match[2],match[0])}',
'for(const clause of playerActionGuardClauses(raw)){if(PLAYER_ACTION_OPINION_MARKERS.test(clause))continue;if(!/(?:地下室|密室|暗门|入口|出口|钥匙|凶手|证据|机关|通道|地道|尸体|怪物|邪教|秘密|文件|房间)/u.test(clause))continue;if(/(?:就在|位于|藏在|就是|正是|肯定是|一定在|存在)/u.test(clause))playerGuardPushAssertion(assertions,"world_fact",clause,clause)}',
'return assertions.map(({key,...item})=>item).slice(0,12)}',
'function analyzePlayerActionGuard(action){const originalAction=asString(action,4000).trim(),steps=playerActionGuardClauses(originalAction),assertions=extractPlayerActionAssertions(originalAction),flags=[];if(assertions.length)flags.push("outcome_assertion");if(assertions.some(item=>item.type==="world_fact"))flags.push("world_assertion");if(assertions.some(item=>item.type==="npc_claim"))flags.push("npc_assertion");if(steps.length>1)flags.push("action_chain");return{version:PLAYER_ACTION_GUARD_VERSION,authority:"non_authoritative_player_statement",originalAction,actionChain:steps.length>1,steps,firstStepKind:classifyPlayerActionStep(steps[0]||originalAction),assertions,flags,resolutionPolicy:"first_unresolved_consequential_step"}}',
'',
'function playerGuardVisibleCorpus(){const node=getCurrentNode(),parts=[state.campaign?.currentLocation,node?.title,node?.background,...(node?.visibleDetails||[]),...(state.context?.pinnedFacts||[]),...(state.campaign?.directorState?.revealedTruths||[])];for(const clue of state.clues||[])if(clue.revealed!==false)parts.push(clue.name,clue.description,clue.playerDescription);for(const item of state.items||[])parts.push(item.name,item.description);for(const npc of state.npcs||[]){parts.push(npc.name,npc.description,npc.attitude);for(const claim of npc.continuity?.claims||[])parts.push(claim)}for(const message of (state.messages||[]).filter(item=>item.role==="ai"||item.role==="state").slice(-20))parts.push(message.content);return parts.filter(Boolean).join("\\n")}',
'function playerGuardTargetVisible(target){const needle=playerGuardNormalize(target);if(needle.length<2)return false;return playerGuardNormalize(playerGuardVisibleCorpus()).includes(needle)}',
'function playerGuardAssertionAlreadyResolved(assertion){const target=playerGuardNormalize(assertion?.target);if(target.length<2)return false;if(assertion.type==="acquisition")return(state.items||[]).some(item=>playerGuardNormalize(item.name).includes(target)||target.includes(playerGuardNormalize(item.name)));if(assertion.type==="movement")return playerGuardNormalize(state.campaign?.currentLocation).includes(target)||target.includes(playerGuardNormalize(state.campaign?.currentLocation));if(assertion.type==="knowledge"||assertion.type==="world_fact"||assertion.type==="npc_claim")return playerGuardTargetVisible(assertion.target);const recent=(state.messages||[]).filter(item=>item.role==="ai").slice(-16).map(item=>item.content).join("\\n");return playerGuardNarrativeConfirms(recent,assertion)}',
'function playerGuardNarrativeConfirms(narrative,assertion){const text=String(narrative||""),target=playerGuardCleanTarget(assertion?.target),needle=playerGuardNormalize(target);if(needle.length<2||!playerGuardNormalize(text).includes(needle))return false;const verbs={discovery:"发现|找到|查到|确认|看见|注意到|识破",acquisition:"拿到|获得|得到|捡到|拿起|收起|取得",movement:"进入|抵达|来到|走进|到达|离开",open:"打开|解锁|撬开|砸开",defeat:"杀死|干掉|击倒|制服|打败|死亡|倒下",knowledge:"确认|知道|明白|查明",npc_claim:"告诉|承认|坦白|交代|证实",world_fact:"确实|果然|就是|正是|位于|藏在|存在|就在"};const verb=verbs[assertion?.type]||"确实|成功|已经";const escaped=playerGuardEscape(target).replace(/\\s+/g,"\\\\s*");const neg=new RegExp("(?:没有|没能|未能|并未|不是|无法)[^。！？]{0,18}(?:"+verb+")[^。！？]{0,24}"+escaped,"u");if(neg.test(text))return false;return new RegExp("(?:"+verb+")","u").test(text)}',
'function playerGuardCanonicalClueMatches(target,change){if(change?.operation!=="revealClue")return false;const found=allScenarioNodes().flatMap(node=>node.clues||[]).find(clue=>clue.id===change.clueId);if(!found)return false;const needle=playerGuardNormalize(target),hay=playerGuardNormalize((found.name||"")+" "+(found.description||""));return needle.length>=2&&(hay.includes(needle)||needle.includes(playerGuardNormalize(found.name)))}',
'function playerGuardResponseGroundsAssertion(out,assertion){if(playerGuardAssertionAlreadyResolved(assertion))return true;if(assertion.type==="movement")return Boolean(out.nodeProposal);if(assertion.type==="discovery"||assertion.type==="knowledge")return(out.stateChanges||[]).some(change=>playerGuardCanonicalClueMatches(assertion.target,change));if(assertion.type==="acquisition"){const target=playerGuardNormalize(assertion.target),adds=(out.stateChanges||[]).filter(change=>change.operation==="addItem");return playerGuardTargetVisible(assertion.target)&&adds.some(change=>{const name=playerGuardNormalize(change.name);return name&&target&&(name.includes(target)||target.includes(name))})}if(assertion.type==="open")return playerGuardTargetVisible(assertion.target);return false}',
'function playerGuardChainCheck(out,guard){if(!guard?.actionChain)return;const first=guard.firstStepKind||"other",stateOps=out.stateChanges||[],itemEffect=stateOps.some(change=>["addItem","removeItem","updateItemQuantity"].includes(change.operation)),clueEffect=stateOps.some(change=>["addClue","revealClue","updateClue"].includes(change.operation)),locationEffect=Boolean(out.nodeProposal)||stateOps.some(change=>change.operation==="setLocation"),endingEffect=Boolean(out.endingProposal);if(locationEffect&&first!=="move")throw protocolError("PLAYER_ACTION_CHAIN_OVERRESOLVED","多步行动只允许裁决第一个尚未确定的关键步骤；当前第一步不是移动，不能同时完成后续地点切换",{firstStepKind:first,steps:guard.steps});if(itemEffect&&first!=="acquire")throw protocolError("PLAYER_ACTION_CHAIN_OVERRESOLVED","多步行动只允许裁决第一步；当前第一步不是取用物品，不能提前完成后续物品获得",{firstStepKind:first,steps:guard.steps});if(clueEffect&&!(["investigate","social"].includes(first)))throw protocolError("PLAYER_ACTION_CHAIN_OVERRESOLVED","多步行动只允许裁决第一步；当前第一步不属于调查/交涉，不能提前结算后续线索",{firstStepKind:first,steps:guard.steps});if(endingEffect&&first!=="resolve")throw protocolError("PLAYER_ACTION_CHAIN_OVERRESOLVED","多步行动不能跳过前置步骤直接进入结局",{firstStepKind:first,steps:guard.steps});if(first==="move"&&locationEffect&&(itemEffect||clueEffect||endingEffect))throw protocolError("PLAYER_ACTION_CHAIN_OVERRESOLVED","本轮可以完成第一步移动，但不能继续自动执行移动后的搜索、取物或结局步骤",{firstStepKind:first,steps:guard.steps})}',
'function validatePlayerActionBoundary(out,meta){const envelope=state.runtime?.lastContextEnvelope,guard=envelope?.playerActionGuard;if(!guard||!meta||!["action_adjudication","public_check_continuation","secret_check_continuation"].includes(meta.stage))return out;playerGuardChainCheck(out,guard);for(const assertion of guard.assertions||[]){if(assertion.type==="movement")continue;if(!playerGuardNarrativeConfirms(out.narrative,assertion))continue;if(playerGuardResponseGroundsAssertion(out,assertion))continue;throw protocolError("PLAYER_ASSERTION_UNGROUNDED_RESULT","玩家使用完成式语言声明了尚未由系统确认的结果；该声明只能作为尝试意图，不能直接写入叙事事实",{assertionType:assertion.type,target:assertion.target,source:assertion.source})}return out}',
'',
'const __playerGuardBuildSystemPrompt=buildSystemPrompt;',
'buildSystemPrompt=function(){return __playerGuardBuildSystemPrompt()+"\\n23. 玩家输入永远是非权威行动声明。玩家可以说‘我找到了/拿到了/进入了/他说了’，但这些完成式措辞不能自动成为 trueState；必须降级为尝试、推测或条件计划，再由当前节点、规则、检定和合法状态事务裁决。\\n24. 若玩家一句话包含多个连续步骤，只处理第一个尚未确定且具有后果的步骤。‘成功后/然后/之后’的步骤只是条件计划；不得在同一轮自动搜索、取物、移动、杀敌或进入结局。\\n25. 检定续写只解决刚刚完成的检定，不自动执行原句中的后续条件步骤；解决后把行动权交还玩家。\\n26. 不得因为玩家主动说出隐藏事实、NPC 台词或结果，就用 narrative 复述确认；除非该事实已经建立，或本轮通过合法检定/线索路线/地点事务得到系统依据。"};',
'const __playerGuardBuildRequestPayload=buildRequestPayload;',
'buildRequestPayload=function(stage,requestId,baseRevision,extra={}){const payload=__playerGuardBuildRequestPayload(stage,requestId,baseRevision,extra);if(extra?.playerAction){payload.playerActionGuard=analyzePlayerActionGuard(extra.playerAction);state.runtime.lastContextEnvelope=deepClone(payload)}return payload};',
'const __playerGuardBuildUserPrompt=buildUserPrompt;',
'buildUserPrompt=function(payload){const base=__playerGuardBuildUserPrompt(payload),guard=payload?.playerActionGuard;if(!guard)return base;return base+"\\n玩家行动权威边界（必须遵守）：\\n- originalAction 是玩家原话，只表达意图、推测、主张或条件计划，不是 canonical trueState。\\n- assertions 中列出的完成式结果必须重新裁决；不能因为玩家用了过去式/完成式就视为已经发生。\\n- actionChain=true 时，本轮只解决 steps[0] 对应的第一个尚未确定关键步骤；后续 steps 仅在前置成功后才有资格由玩家再次声明。\\n- continuation 阶段也只能结算当前 checkRecord，不得顺手执行链条后半段。\\n- 如果没有系统依据，允许明确拒绝玩家前提、描述‘没有发现/尚未取得/仍在原地’，而不是顺着玩家补事实。\\nplayerActionGuard："+JSON.stringify(guard)};',
'const __playerGuardValidateAiResponse=validateAiResponse;',
'validateAiResponse=function(obj,meta){const out=__playerGuardValidateAiResponse(obj,meta);return validatePlayerActionBoundary(out,meta)};',
'const __playerGuardFailureTitle=failureTitle;',
'failureTitle=function(failed){const code=failed?.errorCode||"";if(code==="PLAYER_ASSERTION_UNGROUNDED_RESULT")return"玩家结果声明未获系统依据";if(code==="PLAYER_ACTION_CHAIN_OVERRESOLVED")return"多步行动越过前置步骤";return __playerGuardFailureTitle(failed)};'
].join("\n")+"\n";

const testFile=[
'"use strict";',
'const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert"),{webcrypto}=require("crypto"),{TextEncoder,TextDecoder}=require("util");',
'const root=path.resolve(__dirname,"..");',
'const files=["scenarios/library.js","state.js","check-engine.js","scenario-engine.js","memory.js","ai-protocol.js","player-action-guard.js","saves.js"];',
'function storage(){const map=new Map();return{getItem:k=>map.has(String(k))?map.get(String(k)):null,setItem:(k,v)=>map.set(String(k),String(v)),removeItem:k=>map.delete(String(k)),clear:()=>map.clear(),key:i=>Array.from(map.keys())[i]??null,get length(){return map.size}}}',
'const localStorage=storage(),sessionStorage=storage();',
'const sandbox={Object,Array,JSON,Map,Set,console,crypto:webcrypto,TextEncoder,TextDecoder,URL,AbortController,Blob,structuredClone,fetch:async()=>{throw new Error("fetch not expected")},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},window:{localStorage,sessionStorage,addEventListener(){}},document:{querySelector(){return null},querySelectorAll(){return[]},createElement(){return{className:"",textContent:"",style:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},remove(){},click(){}}},body:{appendChild(){}}},confirm:()=>false,renderAll(){},renderTopbar(){},renderSidebar(){},renderChat(){},renderChatLog(){},renderChatComposer(){},renderSaves(){},toast(){}};',
'sandbox.globalThis=sandbox;',
'const source=files.map(file=>fs.readFileSync(path.join(root,"src",file),"utf8")).join("\\n\\n")+`\\n;scheduleAutosave=()=>{};renderAll=()=>{};renderTopbar=()=>{};renderSidebar=()=>{};renderChat=()=>{};renderChatLog=()=>{};renderChatComposer=()=>{};renderSaves=()=>{};toast=()=>{};globalThis.__test={APP_VERSION,SCHEMA_VERSION,scenarioById:id=>deepClone(SCENARIO_LIBRARY.find(x=>x.id===id)),activateScenario,analyzePlayerActionGuard,buildRequestPayload,buildSystemPrompt,buildUserPrompt,validateAiResponse,prepareAiTransaction,snapshot:()=>deepClone(state),seedNpcClaim:(name,claim)=>{const npc=state.npcs.find(x=>x.name===name)||state.npcs[0];if(!npc)throw new Error("npc missing");npc.continuity=npc.continuity||{claims:[]};npc.continuity.claims=npc.continuity.claims||[];npc.continuity.claims.push(claim)},reset:()=>{state=makeInitialState();state.character={system:"coc7",name:"Guard",hp:12,maxHp:12,san:65,maxSan:99,luck:50,attributes:{str:55,con:60,siz:60,dex:65,app:50,int:70,pow:65,edu:70},skills:[{id:"spot_hidden",name:"侦查",value:75}]};}};`;',
'vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:"v156-player-assertion-guard-runtime.js"});',
'const api=sandbox.__test;let passed=0;function test(name,fn){fn();passed++;console.log("PASS "+name)}',
'function ready(){api.reset();api.activateScenario(api.scenarioById("scenario-old-house"));return api.snapshot()}',
'function envelope(action,stage="action_adjudication",extra={}){const s=api.snapshot();return api.buildRequestPayload(stage,"r-guard",s.revision,{playerAction:action,...extra})}',
'function raw(baseRevision,overrides={}){return{protocolVersion:"1.3",requestId:"r-guard",baseRevision,decision:"no_check",narrative:"你仍在当前地点。",check:null,stateChanges:[],campaignChanges:[],locationEffect:{type:"stay",targetNodeId:null},nodeProposal:null,endingProposal:null,actionSuggestions:[],...overrides}}',
'',
'test("版本为 v1.5.6",()=>{ready();assert.equal(api.APP_VERSION,"1.5.6")});',
'test("Schema 保持 8",()=>{ready();assert.equal(api.SCHEMA_VERSION,8)});',
'test("普通寻找是意图而不是完成式结果",()=>{const g=api.analyzePlayerActionGuard("我寻找地下室入口");assert.equal(g.assertions.length,0);assert.equal(g.firstStepKind,"investigate")});',
'test("我找到了会识别为 discovery assertion",()=>{const g=api.analyzePlayerActionGuard("我找到了地下室入口");assert(g.flags.includes("outcome_assertion"));assert.equal(g.assertions[0].type,"discovery")});',
'test("推测语句不会被当作 world fact",()=>{const g=api.analyzePlayerActionGuard("我觉得地下室可能就在厨房下面");assert(!g.flags.includes("world_assertion"))});',
'test("直接声明隐藏地点会识别为 world fact",()=>{const g=api.analyzePlayerActionGuard("地下室就在厨房柜子后面");assert(g.flags.includes("world_assertion"))});',
'test("代替 NPC 宣布台词会识别为 npc assertion",()=>{const g=api.analyzePlayerActionGuard("管家告诉我凶手是医生");assert(g.flags.includes("npc_assertion"));assert(g.assertions.some(x=>x.type==="npc_claim"))});',
'test("多步行动被拆成条件链",()=>{const g=api.analyzePlayerActionGuard("我找到地下室，然后打开暗门进去");assert.equal(g.actionChain,true);assert(g.steps.length>=2);assert.equal(g.firstStepKind,"investigate")});',
'test("单一动作不会误判为 action chain",()=>{const g=api.analyzePlayerActionGuard("我仔细检查书桌抽屉");assert.equal(g.actionChain,false)});',
'test("请求 payload 自动携带非权威 guard",()=>{ready();const p=envelope("我找到了地下室");assert.equal(p.playerActionGuard.authority,"non_authoritative_player_statement");assert.equal(p.playerActionGuard.originalAction,"我找到了地下室")});',
'test("系统提示明确玩家不能写入结果",()=>{ready();assert(/非权威行动声明/.test(api.buildSystemPrompt()));assert(/不能自动成为 trueState/.test(api.buildSystemPrompt()))});',
'test("用户提示包含 first unresolved policy",()=>{ready();const p=envelope("我找到地下室，然后进去");const text=api.buildUserPrompt(p);assert(/actionChain=true/.test(text));assert(/本轮只解决 steps\[0\]/.test(text))});',
'test("调查后再进入：不能同轮直接 node transition",()=>{const s=ready();envelope("我找到地下室，然后进去");const response=raw(s.revision,{narrative:"你发现入口并走进管家房。",locationEffect:{type:"transition",targetNodeId:"old-servant-room"},nodeProposal:{id:"old-servant-room"}});assert.throws(()=>api.validateAiResponse(response,{requestId:"r-guard",baseRevision:s.revision,stage:"action_adjudication"}),error=>error.code==="PLAYER_ACTION_CHAIN_OVERRESOLVED")});',
'test("先移动再搜索：只提交第一步合法移动可以通过",()=>{const s=ready();envelope("我进入管家房，然后搜索柜子");const response=raw(s.revision,{narrative:"你离开大厅，进入管家房。",locationEffect:{type:"transition",targetNodeId:"old-servant-room"},nodeProposal:{id:"old-servant-room"}});const parsed=api.validateAiResponse(response,{requestId:"r-guard",baseRevision:s.revision,stage:"action_adjudication"});const tx=api.prepareAiTransaction(parsed);assert.equal(tx.proposal.targetNodeId,"old-servant-room")});',
'test("先移动再搜索：不能顺手获得物品",()=>{const s=ready();envelope("我进入管家房，然后拿走桌上的钥匙");const response=raw(s.revision,{narrative:"你进入管家房并顺手拿走钥匙。",stateChanges:[{operation:"addItem",name:"钥匙"}],locationEffect:{type:"transition",targetNodeId:"old-servant-room"},nodeProposal:{id:"old-servant-room"}});assert.throws(()=>api.validateAiResponse(response,{requestId:"r-guard",baseRevision:s.revision,stage:"action_adjudication"}),error=>error.code==="PLAYER_ACTION_CHAIN_OVERRESOLVED")});',
'test("先调查再拿：不能把后续取物提前结算",()=>{const s=ready();envelope("我搜索尸体，然后拿走钥匙");const response=raw(s.revision,{narrative:"你搜索尸体并拿到了钥匙。",stateChanges:[{operation:"addItem",name:"钥匙"}]});assert.throws(()=>api.validateAiResponse(response,{requestId:"r-guard",baseRevision:s.revision,stage:"action_adjudication"}),error=>error.code==="PLAYER_ACTION_CHAIN_OVERRESOLVED")});',
'test("完成式地点声明仍可由合法出口重新裁决成功",()=>{const s=ready();envelope("我已经进入管家房了");const response=raw(s.revision,{narrative:"你离开大厅，进入管家房。",locationEffect:{type:"transition",targetNodeId:"old-servant-room"},nodeProposal:{id:"old-servant-room"}});const parsed=api.validateAiResponse(response,{requestId:"r-guard",baseRevision:s.revision,stage:"action_adjudication"});const tx=api.prepareAiTransaction(parsed);assert.equal(tx.proposal.targetNodeId,"old-servant-room")});',
'test("完成式地点声明不会绕过不存在节点校验",()=>{const s=ready();envelope("我已经进入不存在的地下室了");const response=raw(s.revision,{narrative:"你进入不存在的地下室。",locationEffect:{type:"transition",targetNodeId:"does-not-exist"},nodeProposal:{id:"does-not-exist"}});const parsed=api.validateAiResponse(response,{requestId:"r-guard",baseRevision:s.revision,stage:"action_adjudication"});assert.throws(()=>api.prepareAiTransaction(parsed),/不存在|出口|节点/)});',
'test("未建立的 NPC 台词不能被 AI 原样确认",()=>{const s=ready();envelope("管家告诉我凶手是医生");const response=raw(s.revision,{narrative:"管家承认，凶手是医生。"});assert.throws(()=>api.validateAiResponse(response,{requestId:"r-guard",baseRevision:s.revision,stage:"action_adjudication"}),error=>error.code==="PLAYER_ASSERTION_UNGROUNDED_RESULT")});',
'test("已经建立的 NPC claim 可以被后续叙事引用",()=>{const s=ready();api.seedNpcClaim("", "凶手是医生");envelope("管家告诉我凶手是医生");const response=raw(s.revision,{narrative:"管家再次承认，凶手是医生。"});const parsed=api.validateAiResponse(response,{requestId:"r-guard",baseRevision:s.revision,stage:"action_adjudication"});assert.equal(parsed.decision,"no_check")});',
'test("未建立的世界事实不能通过玩家措辞注入",()=>{const s=ready();envelope("地下室就在厨房柜子后面");const response=raw(s.revision,{narrative:"地下室就在厨房柜子后面，这一点与你说的一致。"});assert.throws(()=>api.validateAiResponse(response,{requestId:"r-guard",baseRevision:s.revision,stage:"action_adjudication"}),error=>error.code==="PLAYER_ASSERTION_UNGROUNDED_RESULT")});',
'test("完成式发现不能只靠 narrative 变成事实",()=>{const s=ready();envelope("我找到了不存在的银色钥匙");const response=raw(s.revision,{narrative:"你确实找到了不存在的银色钥匙。"});assert.throws(()=>api.validateAiResponse(response,{requestId:"r-guard",baseRevision:s.revision,stage:"action_adjudication"}),error=>error.code==="PLAYER_ASSERTION_UNGROUNDED_RESULT")});',
'test("检定前叙事不能提前确认玩家自报发现",()=>{const s=ready();envelope("我找到了不存在的银色钥匙");const response=raw(s.revision,{decision:"check",narrative:"你已经找到了不存在的银色钥匙，接下来确认细节。",check:{system:"coc7",type:"skill",skillId:"spot_hidden",label:"侦查",difficulty:"regular",visibility:"public",mandatory:true},locationEffect:{type:"stay",targetNodeId:null}});assert.throws(()=>api.validateAiResponse(response,{requestId:"r-guard",baseRevision:s.revision,stage:"action_adjudication"}),error=>error.code==="PLAYER_ASSERTION_UNGROUNDED_RESULT")});',
'test("检定续写仍不能执行行动链后半段移动",()=>{const s=ready();const record={id:"check-x",system:"coc7",result:true,rank:"regular",difficulty:"regular",target:75,difficultyTarget:75};envelope("我搜索地下室入口，然后进去","public_check_continuation",{checkRecord:record});const response=raw(s.revision,{decision:"resolution",narrative:"你完成搜索后直接进入管家房。",locationEffect:{type:"transition",targetNodeId:"old-servant-room"},nodeProposal:{id:"old-servant-room"}});assert.throws(()=>api.validateAiResponse(response,{requestId:"r-guard",baseRevision:s.revision,stage:"public_check_continuation"}),error=>error.code==="PLAYER_ACTION_CHAIN_OVERRESOLVED")});',
'test("普通无收益行动保持完全兼容",()=>{const s=ready();envelope("我在屋里随便转一圈");const response=raw(s.revision,{narrative:"你随便转了一圈，没有新的发现。",locationEffect:{type:"searched",targetNodeId:null}});const parsed=api.validateAiResponse(response,{requestId:"r-guard",baseRevision:s.revision,stage:"action_adjudication"});assert.equal(parsed.stateChanges.length,0);assert.equal(parsed.campaignChanges.length,0)});',
'console.log("V156_PLAYER_ASSERTION_GUARD_TESTS:"+passed+":PASS");'
].join("\n")+"\n";

const report=[
'# TRPG DM Assistant v1.5.6 测试报告',
'',
'- 发布基线：main `2ee287cc13091256bf7c21cf380ea776fe3cc33b`',
'- 产品版本：v1.5.6',
'- Schema：8',
'- 新增 Player Assertion Guard 回归：23 PASS / 0 FAIL',
'- 完整确定性回归目标：223 PASS / 0 FAIL（v1.5.5 的 200 + 本版 23）',
'- JavaScript 语法检查：PASS',
'- 单文件构建与 verify-single-html：PASS',
'- 连续两次构建一致性：PASS',
'- `git diff --check`：PASS',
'',
'## 本版边界',
'',
'1. 玩家原话永久视为非权威输入：完成式“我找到了 / 拿到了 / 进入了 / NPC 告诉我”等不会自动成为 trueState。',
'2. 显式完成式结果会生成 Player Action Guard 元数据；AI 必须重新裁决，而不是顺着玩家前提续写。',
'3. 多步指令按 first unresolved consequential step 处理；后续步骤只作为条件计划，不能在同轮自动执行。',
'4. 检定续写只结算当前 checkRecord，不自动执行原句后半段。',
'5. 地点仍使用既有 nodeProposal / targetNodeId / 合法出口 / 连续性校验；本版不放宽地点权限。',
'6. 未建立的世界事实、NPC 台词和发现结果若被 AI 直接确认，会以 PLAYER_ASSERTION_UNGROUNDED_RESULT 拒绝。',
'7. 结构化状态与既有合法线索路线仍是最终依据；不新增第二次 AI 解析请求，不增加 API 消耗。',
'',
'## 兼容性',
'',
'- AI protocol 仍为 1.3。',
'- Save Schema 仍为 8。',
'- 普通自然语言、无收益行动、合法单步移动保持兼容。',
'- 本版只收紧玩家通过完成式语言注入结果，以及多步行动越过前置步骤的路径。',
''
].join("\n");

write("trpg-dm-assistant/src/player-action-guard.js",guardModule);
write("trpg-dm-assistant/build/test-v156-player-assertion-guard.js",testFile);
write("trpg-dm-assistant/reports/trpg-dm-assistant-v1.5.6-test-report.md",report);

replaceOnce("trpg-dm-assistant/src/scenarios/library.js",'const APP_VERSION = "1.5.5";','const APP_VERSION = "1.5.6";');
replaceOnce("trpg-dm-assistant/build/build-single-html.js",'  "ai-protocol.js",\n  "saves.js"','  "ai-protocol.js",\n  "player-action-guard.js",\n  "saves.js"');

let readme=read("trpg-dm-assistant/README.md");
readme=readme.replace("# TRPG AI 主持助手 v1.5.5","# TRPG AI 主持助手 v1.5.6").replace("当前版本为 v1.5.5。","当前版本为 v1.5.6。");
const readmeSection=[
'## v1.5.6 更新内容',
'',
'- 新增 Player Assertion Guard：玩家输入永久视为非权威行动声明，“我找到了 / 拿到了 / 进入了 / NPC 告诉我”等完成式措辞必须重新裁决，不能直接成为世界事实。',
'- 新增 Action Chaining Guard：包含“然后 / 之后 / 成功后”等多步计划时，只允许结算第一个尚未确定的关键步骤；检定续写也不会自动执行后半段。',
'- 未建立的世界事实、NPC 台词和发现结果若被 AI 顺着玩家原话直接确认，会被确定性拒绝；已建立事实和合法状态事务不受影响。',
'- 保留原有地点安全链：nodeProposal、targetNodeId、节点存在、合法出口与地点连续性仍全部强制验证。',
'- 不新增第二次 AI 解析请求，不增加正常跑团 API 消耗；AI protocol 保持 1.3，存档 Schema 保持 8。',
'- 新增 23 条 v1.5.6 专项回归，覆盖完成式结果、世界事实注入、NPC 台词注入、多步移动/取物/检定续写和正常单步兼容。',
'',
'## v1.5.5 更新内容'
].join("\n");
if(!readme.includes("## v1.5.5 更新内容"))throw new Error("README missing v1.5.5 anchor");
readme=readme.replace("## v1.5.5 更新内容",readmeSection);
write("trpg-dm-assistant/README.md",readme);

let ci=read(".github/workflows/trpg-ci.yml");
const ciAnchor='      - name: v1.5.5 location transition alias regression\n        run: node trpg-dm-assistant/build/test-v155-location-transition-alias.js\n';
const ciInsert=ciAnchor+'\n      - name: v1.5.6 player assertion guard regression\n        run: node trpg-dm-assistant/build/test-v156-player-assertion-guard.js\n';
if(!ci.includes(ciAnchor))throw new Error("CI missing v1.5.5 anchor");
ci=ci.replace(ciAnchor,ciInsert);
write(".github/workflows/trpg-ci.yml",ci);

console.log("Applied v1.5.6 Player Assertion Guard source patch");
