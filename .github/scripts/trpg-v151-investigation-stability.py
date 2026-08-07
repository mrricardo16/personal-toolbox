from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"无法定位：{label}")
    return text.replace(old, new, 1)


def replace_between(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    end = text.find(end_marker, start + len(start_marker))
    if start < 0 or end < 0:
        raise RuntimeError(f"无法定位：{label}")
    return text[:start] + replacement.rstrip() + "\n" + text[end:]


root = Path("trpg-dm-assistant")

# ---------------------------------------------------------------------------
# Version
# ---------------------------------------------------------------------------
library_path = root / "src/scenarios/library.js"
library = library_path.read_text(encoding="utf-8")
library = replace_once(library, 'const APP_VERSION = "1.5.0";', 'const APP_VERSION = "1.5.1";', "APP_VERSION")
library_path.write_text(library, encoding="utf-8")

# ---------------------------------------------------------------------------
# State defaults: less chat-history dependence, keep last turn impact for audit.
# ---------------------------------------------------------------------------
state_path = root / "src/state.js"
state = state_path.read_text(encoding="utf-8")
state = replace_once(
    state,
    'lastContextEnvelope:null,lastLoreSelection:[],hintGenerating:false',
    'lastContextEnvelope:null,lastLoreSelection:[],lastTurnImpact:null,hintGenerating:false',
    "runtime.lastTurnImpact",
)
state = replace_once(
    state,
    'context:{rollingSummary:"",recentMessageLimit:20,summaryThreshold:30,',
    'context:{rollingSummary:"",recentMessageLimit:12,summaryThreshold:30,',
    "默认 recentMessageLimit",
)
state_path.write_text(state, encoding="utf-8")

# ---------------------------------------------------------------------------
# Scenario/context engine: NPC continuity, turn-impact classification,
# non-forced pacing, priority-based context packing.
# ---------------------------------------------------------------------------
scenario_path = root / "src/scenario-engine.js"
scenario = scenario_path.read_text(encoding="utf-8")

helpers = r'''const MAX_NPC_CONTINUITY_CLAIMS=12;
function ensureNpcContinuity(npc){
  if(!isPlainObject(npc))return{claims:[],relationship:"",currentIntent:"",lastInteraction:"",lastInteractionTurn:-1};
  const source=isPlainObject(npc.continuity)?npc.continuity:{};
  npc.continuity={claims:listStrings(source.claims,MAX_NPC_CONTINUITY_CLAIMS,500),relationship:asString(source.relationship,300),currentIntent:asString(source.currentIntent,500),lastInteraction:asString(source.lastInteraction,700),lastInteractionTurn:Number.isFinite(Number(source.lastInteractionTurn))?Number(source.lastInteractionTurn):-1};
  return npc.continuity
}
function applyNpcContinuityPatch(npc,raw={}){
  const continuity=ensureNpcContinuity(npc),claim=asString(raw.claim,500).trim();
  if(claim&&!continuity.claims.includes(claim)){continuity.claims.push(claim);if(continuity.claims.length>MAX_NPC_CONTINUITY_CLAIMS)continuity.claims.splice(0,continuity.claims.length-MAX_NPC_CONTINUITY_CLAIMS)}
  if(raw.relationship!==undefined)continuity.relationship=asString(raw.relationship,300);
  if(raw.currentIntent!==undefined)continuity.currentIntent=asString(raw.currentIntent,500);
  if(raw.lastInteraction!==undefined)continuity.lastInteraction=asString(raw.lastInteraction,700);
  if(claim||raw.relationship!==undefined||raw.currentIntent!==undefined||raw.lastInteraction!==undefined)continuity.lastInteractionTurn=Number(state.campaign?.directorState?.totalTurns||0);
  return npc
}
function npcContinuityContext({debug=false}={}){
  const current=getCurrentNode(),currentIds=new Set((current?.npcs||[]).map(item=>asString(item?.id,100)).filter(Boolean)),merged=new Map();
  for(const item of current?.npcs||[]){if(!item?.id)continue;merged.set(item.id,{id:item.id,name:asString(item.name,160),description:asString(item.description,500),attitude:asString(item.attitude,120)})}
  for(const item of state.npcs||[]){if(!item?.id)continue;merged.set(item.id,{...(merged.get(item.id)||{}),...deepClone(item)})}
  const motives=new Map((state.scenario?.director?.npcMotives||[]).filter(item=>item?.npcId).map(item=>[item.npcId,item]));
  const entries=Array.from(merged.values()).map(item=>{const continuity=ensureNpcContinuity(item),base={id:item.id,name:item.name||item.id,attitude:asString(item.attitude,120),claims:continuity.claims,relationship:continuity.relationship,lastInteraction:continuity.lastInteraction,lastInteractionTurn:continuity.lastInteractionTurn};if(debug){base.currentIntent=continuity.currentIntent;const motive=motives.get(item.id);if(motive)base.directorMotive={goal:asString(motive.goal,800),fear:asString(motive.fear,500),leverage:asString(motive.leverage,500)}}return{...base,_score:(currentIds.has(item.id)?1000:0)+(continuity.currentIntent?200:0)+Math.max(0,Number(continuity.lastInteractionTurn||-1))}});
  entries.sort((a,b)=>b._score-a._score);return entries.slice(0,12).map(({_score,...entry})=>entry)
}
function safeContextCoreState(){
  const character=state.character||{},director=state.campaign?.directorState||defaultDirectorState();return{revision:state.revision,location:state.campaign?.currentLocation||getCurrentNode()?.title||"",time:state.campaign?.currentTime||"",character:{name:character.name,occupation:character.occupation||character.className,hp:character.hp,maxHp:character.maxHp,san:character.san,maxSan:character.maxSan,luck:character.luck},director:{tension:director.tension,maxTension:director.maxTension,progress:director.progress,sceneTurns:director.sceneTurns,totalTurns:director.totalTurns},items:(state.items||[]).slice(0,30).map(item=>({id:item.id,name:item.name,quantity:item.quantity})),statuses:(state.statuses||[]).slice(0,20).map(item=>({id:item.id,name:item.name,description:item.description})),resources:state.resources,confirmedClues:(state.clues||[]).filter(item=>item.revealed!==false).slice(-12).map(item=>({id:item.id,name:item.name,description:item.playerDescription||item.description,quality:item.discoveryQuality||null})),lastTurnImpact:state.runtime?.lastTurnImpact||null}}
function classifyTurnImpact(parsed){
  if(parsed?.locationEffect?.type==="transition_proposal"||parsed?.nodeProposal)return"transition";
  const stateOps=new Set((parsed?.stateChanges||[]).map(item=>item.operation)),campaignOps=new Set((parsed?.campaignChanges||[]).map(item=>item.operation));
  if(["addClue","revealClue"].some(op=>stateOps.has(op))||["resolveLead","resolveQuestion","addRevealedTruth","setOutcome"].some(op=>campaignOps.has(op))||(parsed?.campaignChanges||[]).some(item=>item.operation==="adjustProgress"&&Number(item.amount)>0))return"progress";
  if(["adjustHp","adjustSan","removeItem","addStatus","advanceTime"].some(op=>stateOps.has(op))||["adjustTension","addThreat","advanceClock"].some(op=>campaignOps.has(op)))return"risk";
  if(["addNpc","updateNpc","addItem","updateItemQuantity","setScenarioFlag","clearScenarioFlag"].some(op=>stateOps.has(op))||["addLead","addQuestion","setDirectorNote"].some(op=>campaignOps.has(op)))return"informational";
  return"neutral"
}
'''
if "function ensureNpcContinuity(" not in scenario:
    scenario = replace_once(scenario, "function pacingDirective(){", helpers + "\nfunction pacingDirective(){", "NPC/context helper insert")

old_pacing = 'function pacingDirective(){const d=state.campaign?.directorState||defaultDirectorState(),stalled=Number(d.sceneTurns||0)-Number(d.lastProgressTurn||0),event=state.runtime.pendingDirectorEvent;if(event?.kind==="climax_gate"||Number(d.tension||1)>=6)return"张力已经达到高潮阈值。本轮必须开放高潮行动、撤退机会或结局门，不得继续添加无关谜团。";if(event?.kind==="pressure"||stalled>=5)return"世界必须主动变化：推进威胁时钟、让 NPC 采取行动或引入有代价的替代线索，不能继续原地描述。";if(event?.kind==="environment_shift"||stalled>=3)return"采用失败前进：提供可继续调查的信息，同时增加时间、风险或张力代价。";return"保持调查节奏；关键线索不得只有唯一获取路径。"}'
new_pacing = 'function pacingDirective(){const d=state.campaign?.directorState||defaultDirectorState(),stalled=Number(d.sceneTurns||0)-Number(d.lastProgressTurn||0),event=state.runtime.pendingDirectorEvent;if(event?.kind==="climax_gate"||Number(d.tension||1)>=6)return"张力已经达到高潮阈值。让既有威胁进入危机、撤退或结局窗口，不得继续添加无关谜团。";if(event?.kind==="pressure"||stalled>=5)return"世界必须主动变化：让既有 NPC、威胁、时间或环境采取行动。可以造成代价或改变局势，但不得为了推进而强送关键线索或正确答案。";if(event?.kind==="environment_shift"||stalled>=3)return"连续数轮没有实质推进仍是合法调查节奏。可以加入轻微环境变化、NPC 动作或时间感，但不要强制线索、奖励、检定或进度。";return"允许无收益行动；保持调查节奏，关键线索不得只有唯一获取路径。"}'
scenario = replace_once(scenario, old_pacing, new_pacing, "pacingDirective")

context_fn = r'''function buildContextSnapshot(extraText="",{debug=false}={}){
  const budget=currentContextBudget(),lore=getTriggeredLoreCards(extraText),publicChecks=state.checkRecords.filter(record=>debug||(!record.hiddenFromPlayer&&record.visibility!=="secret")).slice(-6),recentLimit=Math.min(12,clamp(Number(state.context?.recentMessageLimit||12),4,12));
  let recent=state.messages.slice(-recentLimit).map(message=>({role:message.role,content:message.content})),rolling=asString(state.context.rollingSummary,8000),activeLore=lore.map(card=>({id:card.id,title:card.title,content:debug||card.visibility==="player"?card.content:"[主持资料已触发，普通预览隐藏正文]",visibility:card.visibility,matchedTriggers:card.matchedTriggers}));
  const fixed={systemRules:{style:state.config.narrativeStyle,boundaries:state.config.contentBoundaries,strictness:state.config.ruleStrictness},trueState:safeContextCoreState(),currentScene:getCurrentNode(),pinnedFacts:listStrings(state.context.pinnedFacts,50,500),activeLeads:(state.campaign.activeLeads||[]).filter(item=>item.status!=="resolved"),unresolvedQuestions:(state.campaign.unresolvedQuestions||[]).filter(item=>item.status!=="resolved"),npcContinuity:npcContinuityContext({debug}),directorNote:state.context.directorNote||{},recentChecks:publicChecks,playerAction:extraText,pacingDirective:pacingDirective(),directorEvent:state.runtime.pendingDirectorEvent};
  if(debug){fixed.scenarioDirector=state.scenario?.director||null;fixed.secretChecks=state.checkRecords.filter(record=>record.visibility==="secret"||record.hiddenFromPlayer).slice(-12)}
  let remaining=Math.max(0,budget.total-countChars(fixed));
  const loreAllowance=Math.min(budget.lore,remaining);while(activeLore.length&&countChars(activeLore)>loreAllowance)activeLore.pop();remaining=Math.max(0,remaining-countChars(activeLore));
  const rollingAllowance=Math.min(6000,Math.floor(remaining*.35));if(rolling.length>rollingAllowance)rolling=rolling.slice(-rollingAllowance);remaining=Math.max(0,remaining-rolling.length);
  while(recent.length&&countChars(recent)>remaining)recent.shift();
  const layers={...fixed,activeLoreCards:activeLore,rollingSummary:rolling,recentMessages:recent};const metrics={};for(const [key,value] of Object.entries(layers))metrics[key]=countChars(value);metrics.total=Object.values(metrics).reduce((sum,value)=>sum+value,0);metrics.budget=budget.total;metrics.overBudget=Math.max(0,metrics.total-budget.total);metrics.recentMessageLimit=recentLimit;return{...layers,metrics,loreSelection:state.runtime.lastLoreSelection||[]}
}'''
scenario = replace_between(scenario, "function buildContextSnapshot(", "function endingConditionMatches", context_fn + "\nfunction endingConditionMatches", "buildContextSnapshot")
scenario_path.write_text(scenario, encoding="utf-8")

# ---------------------------------------------------------------------------
# AI protocol: explicit no-reward rule + extend existing updateNpc operation.
# ---------------------------------------------------------------------------
ai_path = root / "src/ai-protocol.js"
ai = ai_path.read_text(encoding="utf-8")

ai = replace_once(
    ai,
    '15. 内容边界：${state.config.contentBoundaries||"无额外说明"}。叙事风格：${state.config.narrativeStyle||"克制、调查优先"}。\n16. ${pacingDirective()}` }',
    '15. 单轮行动可以没有收益。普通观察、闲聊、等待、走错方向、重复搜索都可以只产生自然叙事；不得为了回应玩家而凭空制造线索、暗门、钥匙、新 NPC、检定或调查进度。\n16. 普通环境信息不等于正式线索。只有真正具有持续调查价值并满足获取规则的信息才进入线索状态。\n17. NPC 说出重要承诺、否认、解释、改口，或态度/关系/当前意图发生长期变化时，复用 updateNpc 更新连续性；后续发言必须尊重已记录 claims。故意撒谎或改口必须在世界中存在合理原因。\n18. 连续无进展时让既有世界主动行动，而不是给玩家正确答案。\n19. 内容边界：${state.config.contentBoundaries||"无额外说明"}。叙事风格：${state.config.narrativeStyle||"克制、调查优先"}。\n20. ${pacingDirective()}` }',
    "system prompt stability rules",
)

ai = replace_once(
    ai,
    '不得在玩家可见叙事中列出后台出口或暗示唯一正确路线；普通回合 actionSuggestions 必须为 []。\n输入：${JSON.stringify(payload)}` }',
    '不得在玩家可见叙事中列出后台出口或暗示唯一正确路线；普通回合 actionSuggestions 必须为 []。\nNPC 连续性：复用 updateNpc；除 description/attitude 外，可使用 claim（单条重要说法）、relationship、currentIntent、lastInteraction。只记录会影响后续一致性的内容，普通寒暄不要写状态。\n允许本轮 narrative 有内容而 stateChanges=[]、campaignChanges=[]；这不是错误，也不需要补偿线索或进度。\n输入：${JSON.stringify(payload)}` }',
    "user prompt NPC continuity",
)

old_add_npc = 'else if(op==="addNpc"){const name=reqString(raw,"name",index,"状态变化"),id=asString(raw.npcId,100)||uid("npc");if(draft.npcs.some(x=>x.id===id))throw new Error(`NPC 重复：${id}`);draft.npcs.push({id,name,description:asString(raw.description,1000),attitude:asString(raw.attitude,100)});summaries.push(`新增 NPC：${name}`)}'
new_add_npc = 'else if(op==="addNpc"){const name=reqString(raw,"name",index,"状态变化"),id=asString(raw.npcId,100)||uid("npc");if(draft.npcs.some(x=>x.id===id))throw new Error(`NPC 重复：${id}`);const npc={id,name,description:asString(raw.description,1000),attitude:asString(raw.attitude,100)};applyNpcContinuityPatch(npc,raw);draft.npcs.push(npc);summaries.push(`新增 NPC：${name}`)}'
ai = replace_once(ai, old_add_npc, new_add_npc, "addNpc continuity")

old_update_npc = 'else if(op==="updateNpc"){const id=reqString(raw,"npcId",index,"状态变化"),npc=draft.npcs.find(x=>x.id===id);if(!npc)throw new Error(`NPC 不存在：${id}`);if(raw.description===undefined&&raw.attitude===undefined)throw new Error("必须提供 description 或 attitude");if(raw.description!==undefined)npc.description=asString(raw.description,1000);if(raw.attitude!==undefined)npc.attitude=asString(raw.attitude,100);summaries.push(`更新 NPC：${npc.name}`)}'
new_update_npc = 'else if(op==="updateNpc"){const id=reqString(raw,"npcId",index,"状态变化"),npc=draft.npcs.find(x=>x.id===id);if(!npc)throw new Error(`NPC 不存在：${id}`);const hasContinuity=["claim","relationship","currentIntent","lastInteraction"].some(key=>raw[key]!==undefined);if(raw.description===undefined&&raw.attitude===undefined&&!hasContinuity)throw new Error("必须提供 description、attitude 或 NPC 连续性字段");if(raw.description!==undefined)npc.description=asString(raw.description,1000);if(raw.attitude!==undefined)npc.attitude=asString(raw.attitude,100);applyNpcContinuityPatch(npc,raw);summaries.push(`更新 NPC：${npc.name}`)}'
ai = replace_once(ai, old_update_npc, new_update_npc, "updateNpc continuity")

old_prepare = 'function prepareAiTransaction(parsed,{currentCheckRecordId=null}={}){try{if(parsed.decision==="check"&&(parsed.stateChanges.length||parsed.campaignChanges.length||parsed.nodeProposal||parsed.endingProposal))throw protocolError("STATE_TRANSACTION_REJECTED","检定裁决阶段不得包含结果状态变化");const meaningfulProgress=transactionHasMeaningfulProgress(parsed),prepared=prepareStateChanges(parsed.stateChanges,parsed.campaignChanges,{currentCheckRecordId}),proposal=parsed.nodeProposal?validateNodeProposal(parsed.nodeProposal,prepared.draft.campaign,{meaningfulProgress}):null,ending=parsed.endingProposal?validateEndingProposal(parsed.endingProposal,prepared.draft.campaign,prepared.draft.clues):null;validateLocationContinuity(parsed,proposal,meaningfulProgress);return{parsed,prepared,proposal,ending,meaningfulProgress}}catch(error){if(error?.code)throw error;throw protocolError("STATE_TRANSACTION_REJECTED",`状态变化事务被整体拒绝：${error.message}`)}}'
new_prepare = 'function prepareAiTransaction(parsed,{currentCheckRecordId=null}={}){try{if(parsed.decision==="check"&&(parsed.stateChanges.length||parsed.campaignChanges.length||parsed.nodeProposal||parsed.endingProposal))throw protocolError("STATE_TRANSACTION_REJECTED","检定裁决阶段不得包含结果状态变化");const meaningfulProgress=transactionHasMeaningfulProgress(parsed),turnImpact=classifyTurnImpact(parsed),prepared=prepareStateChanges(parsed.stateChanges,parsed.campaignChanges,{currentCheckRecordId}),proposal=parsed.nodeProposal?validateNodeProposal(parsed.nodeProposal,prepared.draft.campaign,{meaningfulProgress}):null,ending=parsed.endingProposal?validateEndingProposal(parsed.endingProposal,prepared.draft.campaign,prepared.draft.clues):null;validateLocationContinuity(parsed,proposal,meaningfulProgress);return{parsed,prepared,proposal,ending,meaningfulProgress,turnImpact}}catch(error){if(error?.code)throw error;throw protocolError("STATE_TRANSACTION_REJECTED",`状态变化事务被整体拒绝：${error.message}`)}}'
ai = replace_once(ai, old_prepare, new_prepare, "prepareAiTransaction turn impact")

ai = replace_once(
    ai,
    'state.runtime.pendingActionSuggestions=[];state.runtime.pendingNodeProposal=transaction.proposal;',
    'state.runtime.pendingActionSuggestions=[];state.runtime.lastTurnImpact=transaction.turnImpact||"neutral";state.runtime.pendingNodeProposal=transaction.proposal;',
    "commit lastTurnImpact",
)
ai = replace_once(
    ai,
    'addLog("ai",`AI 响应已事务提交${prepared.count?`，应用 ${prepared.count} 项变化`:""}`,{requestId});',
    'addLog("ai",`AI 响应已事务提交；回合影响=${transaction.turnImpact||"neutral"}${prepared.count?`，应用 ${prepared.count} 项变化`:""}`,{requestId});',
    "AI commit audit",
)
ai_path.write_text(ai, encoding="utf-8")

# ---------------------------------------------------------------------------
# Context viewer: make new priority layer visible without exposing hidden intent
# unless KP debug is enabled (buildContextSnapshot already handles that).
# ---------------------------------------------------------------------------
memory_path = root / "src/memory.js"
memory = memory_path.read_text(encoding="utf-8")
memory = replace_once(
    memory,
    '${section("系统规则",snapshot.systemRules)}${section("角色与真实状态",snapshot.trueState)}${section("当前场景",snapshot.currentScene)}${section("永久事实",snapshot.pinnedFacts)}',
    '${section("系统规则",snapshot.systemRules)}${section("角色与核心状态",snapshot.trueState)}${section("当前场景",snapshot.currentScene)}${section("NPC 连续性",snapshot.npcContinuity)}${section("永久事实",snapshot.pinnedFacts)}',
    "context viewer NPC continuity",
)
memory_path.write_text(memory, encoding="utf-8")

# ---------------------------------------------------------------------------
# Regression tests.
# ---------------------------------------------------------------------------
test_source = r'''"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert");
const root=path.resolve(__dirname,"..");
const scenario=fs.readFileSync(path.join(root,"src/scenario-engine.js"),"utf8"),ai=fs.readFileSync(path.join(root,"src/ai-protocol.js"),"utf8"),stateSource=fs.readFileSync(path.join(root,"src/state.js"),"utf8"),library=fs.readFileSync(path.join(root,"src/scenarios/library.js"),"utf8"),memory=fs.readFileSync(path.join(root,"src/memory.js"),"utf8");
let passed=0;function test(name,fn){fn();passed++;console.log(`PASS ${name}`)}
function extract(startMarker,endMarker){const start=scenario.indexOf(startMarker),end=scenario.indexOf(endMarker,start);assert.ok(start>=0&&end>start,`无法提取 ${startMarker}`);return scenario.slice(start,end)}
const helperCode=extract("const MAX_NPC_CONTINUITY_CLAIMS=12;","function safeContextCoreState");
const sandbox={state:{campaign:{directorState:{totalTurns:7}},npcs:[],scenario:{director:{npcMotives:[]}}},isPlainObject:v=>!!v&&typeof v==="object"&&!Array.isArray(v),listStrings:(v,l,m)=>Array.isArray(v)?v.map(x=>String(x).slice(0,m)).slice(0,l):[],asString:(v,m)=>typeof v==="string"?v.slice(0,m):"",getCurrentNode:()=>({id:"node",title:"大厅",npcs:[]}),deepClone:v=>JSON.parse(JSON.stringify(v)),Number,Math,Set,Map,Array,Object};sandbox.globalThis=sandbox;vm.runInNewContext(helperCode+"\n;globalThis.api={ensureNpcContinuity,applyNpcContinuityPatch,npcContinuityContext};",sandbox,{filename:"v151-npc-helpers.js"});const api=sandbox.api;
test("版本为 v1.5.1",()=>assert.ok(library.includes('const APP_VERSION = "1.5.1";')));
test("新会话最近消息默认 12",()=>assert.ok(stateSource.includes('recentMessageLimit:12')));
test("运行态记录 lastTurnImpact",()=>assert.ok(stateSource.includes('lastTurnImpact:null')));
test("旧 NPC 自动补 continuity",()=>{const npc={id:"n1",name:"管家"};const c=api.ensureNpcContinuity(npc);assert.deepEqual(Array.from(c.claims),[]);assert.equal(c.lastInteractionTurn,-1)});
test("updateNpc 可追加 claim",()=>{const npc={id:"n1",name:"管家"};api.applyNpcContinuityPatch(npc,{claim:"我没有进入书房"});assert.equal(npc.continuity.claims[0],"我没有进入书房");assert.equal(npc.continuity.lastInteractionTurn,7)});
test("重复 claim 自动去重",()=>{const npc={id:"n1"};api.applyNpcContinuityPatch(npc,{claim:"同一句"});api.applyNpcContinuityPatch(npc,{claim:"同一句"});assert.equal(npc.continuity.claims.length,1)});
test("claims 限制为 12 条",()=>{const npc={id:"n1"};for(let i=0;i<20;i++)api.applyNpcContinuityPatch(npc,{claim:`说法${i}`});assert.equal(npc.continuity.claims.length,12);assert.equal(npc.continuity.claims.at(-1),"说法19")});
test("关系意图与最近互动可更新",()=>{const npc={id:"n1"};api.applyNpcContinuityPatch(npc,{relationship:"戒备",currentIntent:"拖延调查员",lastInteraction:"拒绝打开书房"});assert.equal(npc.continuity.relationship,"戒备");assert.equal(npc.continuity.currentIntent,"拖延调查员");assert.equal(npc.continuity.lastInteraction,"拒绝打开书房")});
test("普通 NPC continuity 不包含隐藏意图",()=>{sandbox.state.npcs=[{id:"n1",name:"管家",continuity:{claims:["A"],relationship:"戒备",currentIntent:"隐藏证据",lastInteraction:"谈话",lastInteractionTurn:7}}];const publicView=api.npcContinuityContext({debug:false})[0],debugView=api.npcContinuityContext({debug:true})[0];assert.equal(publicView.currentIntent,undefined);assert.equal(debugView.currentIntent,"隐藏证据")});
const impactCode=extract("function classifyTurnImpact(parsed)","function pacingDirective");vm.runInNewContext(impactCode+"\n;globalThis.classifyTurnImpact=classifyTurnImpact;",sandbox);const classify=sandbox.classifyTurnImpact;
test("空变化行动分类 neutral",()=>assert.equal(classify({stateChanges:[],campaignChanges:[],locationEffect:{type:"stay"},nodeProposal:null}),"neutral"));
test("NPC 互动分类 informational",()=>assert.equal(classify({stateChanges:[{operation:"updateNpc"}],campaignChanges:[],locationEffect:{type:"stay"}}),"informational"));
test("线索分类 progress",()=>assert.equal(classify({stateChanges:[{operation:"revealClue"}],campaignChanges:[],locationEffect:{type:"stay"}}),"progress"));
test("张力分类 risk",()=>assert.equal(classify({stateChanges:[],campaignChanges:[{operation:"adjustTension",amount:1}],locationEffect:{type:"stay"}}),"risk"));
test("地点切换分类 transition",()=>assert.equal(classify({stateChanges:[],campaignChanges:[],locationEffect:{type:"transition_proposal"},nodeProposal:{}}),"transition"));
test("3 轮无进展不再强制失败前进线索",()=>{const pacing=extract("function pacingDirective()","function buildContextSnapshot");assert.ok(!pacing.includes("采用失败前进：提供可继续调查的信息"));assert.ok(pacing.includes("不要强制线索、奖励、检定或进度"))});
test("5 轮无进展让世界行动但不送答案",()=>{const pacing=extract("function pacingDirective()","function buildContextSnapshot");assert.ok(pacing.includes("不得为了推进而强送关键线索或正确答案"))});
const contextFn=extract("function buildContextSnapshot(","function endingConditionMatches");
test("上下文包含 NPC continuity",()=>assert.ok(contextFn.includes("npcContinuity:npcContinuityContext")));
test("API memory 最近消息上限为 12",()=>assert.ok(contextFn.includes("Math.min(12")));
test("Lore 在最近消息之前分配预算",()=>assert.ok(contextFn.indexOf("loreAllowance")<contextFn.indexOf("while(recent.length")));
test("上下文使用精简核心状态",()=>assert.ok(contextFn.includes("trueState:safeContextCoreState()")));
test("系统提示明确允许无收益行动",()=>assert.ok(ai.includes("单轮行动可以没有收益")));
test("系统提示区分环境信息与正式线索",()=>assert.ok(ai.includes("普通环境信息不等于正式线索")));
test("updateNpc 复用连续性字段",()=>assert.ok(ai.includes('["claim","relationship","currentIntent","lastInteraction"]')));
test("请求提示允许空变化合法返回",()=>assert.ok(ai.includes("允许本轮 narrative 有内容而 stateChanges=[]、campaignChanges=[]")));
test("上下文查看器显示 NPC 连续性",()=>assert.ok(memory.includes('section("NPC 连续性",snapshot.npcContinuity)')));
console.log(`V151_INVESTIGATION_STABILITY_TESTS:${passed}:PASS`);
'''
(root / "build/test-v151-investigation-stability.js").write_text(test_source, encoding="utf-8")

# ---------------------------------------------------------------------------
# Documentation / report organization.
# ---------------------------------------------------------------------------
project_readme_path = root / "README.md"
readme = project_readme_path.read_text(encoding="utf-8")
readme = readme.replace("# TRPG AI 主持助手 v1.5.0", "# TRPG AI 主持助手 v1.5.1", 1)
readme = readme.replace("当前版本为 v1.5.0。", "当前版本为 v1.5.1。", 1)
section = """## v1.5.1 更新内容

- 调查主循环允许真正的无收益行动：普通观察、闲聊、等待、重复搜索和走错方向可以只产生自然叙事，不强制线索、奖励、检定或调查进度。
- 调整无进展节奏：连续 3～4 轮只允许轻微世界变化；连续 5 轮以上让既有 NPC、威胁、时间或环境主动行动，但不强送关键线索或正确答案。
- 扩展现有 `updateNpc` 为 NPC 连续性载体，可记录重要说法、关系、当前意图和最近互动；历史说法去重并限制数量。
- API 上下文加入优先级 NPC continuity；普通预览隐藏 NPC 当前意图和幕后动机，KP/API 上下文仍可使用内部连续性。
- 上下文治理改为核心状态、固定事实、调查方向、未解决问题、NPC 连续性与相关 Lore 优先；最近聊天默认从 20 条降至最多 12 条。
- API payload 仍保留 canonical trueState，memory 层改用精简 contextCore，减少重复状态占用。
- 页面自动记录 neutral / informational / progress / risk / transition 回合影响，仅用于节奏、审计与上下文，不向玩家泄露正确路线。
- 新增 v1.5.1 调查稳定性回归测试。

"""
if "## v1.5.1 更新内容" not in readme:
    readme = readme.replace("## v1.5.0 更新内容\n", section + "## v1.5.0 更新内容\n", 1)
readme = readme.replace("## 版本记录\n\n- v1.5.0：", "## 版本记录\n\n- v1.5.1：稳定调查主循环，允许无收益行动，加入 NPC 连续性与上下文优先级治理。\n- v1.5.0：", 1)
readme = readme.replace("- `src/`：v1.5.0 的模块化源码", "- `src/`：v1.5.1 的模块化源码", 1)
readme = readme.replace("- `build/test-coc-outcomes.js`：验证 CoC 等值边界、难度通过线、成功等级和分层线索规则。", "- `build/test-coc-outcomes.js`：验证 CoC 等值边界、难度通过线、成功等级和分层线索规则。\n- `build/test-v151-investigation-stability.js`：验证无收益行动、NPC 连续性、回合影响分类和上下文治理。", 1)
readme = readme.replace("- `reports/v1.5.0-test-report.md`：当前版本测试报告。", "- `reports/v1.5.1-test-report.md`：当前版本测试报告。\n- `reports/v1.5.0-test-report.md`：上一版本测试报告。", 1)
project_readme_path.write_text(readme, encoding="utf-8")

root_readme_path = Path("README.md")
root_readme = root_readme_path.read_text(encoding="utf-8")
root_readme = root_readme.replace("### TRPG AI 主持助手（最新版 v1.5.0）", "### TRPG AI 主持助手（最新版 v1.5.1）", 1)
ability = "- v1.5.1 稳定调查主循环：允许无收益行动，加入 NPC 长期连续性和上下文优先级治理，减少长团中的强行推进与遗忘。\n"
if ability not in root_readme:
    root_readme = root_readme.replace("版本记录：\n\n", ability + "\n版本记录：\n\n", 1)
root_readme = root_readme.replace("版本记录：\n\n- v1.5.0：", "版本记录：\n\n- v1.5.1：稳定调查主循环，允许无收益行动，加入 NPC 连续性与上下文优先级治理。\n- v1.5.0：", 1)
root_readme_path.write_text(root_readme, encoding="utf-8")

report = """# TRPG DM Assistant v1.5.1 测试报告

## 发布目标

稳定长时间调查主循环，不新增战斗等大型规则系统。重点解决 AI 过度推进、NPC 长对话连续性和上下文噪声问题。

## 修复范围

- 普通行动允许没有线索、奖励、进度、检定和状态变化。
- 连续 3～4 轮无进展不再自动失败前进发线索；5 轮以上由世界主动行动，但不保证正确答案。
- `updateNpc` 支持 claim / relationship / currentIntent / lastInteraction 连续性字段。
- NPC 重要说法去重并最多保存 12 条。
- memory 上下文加入 NPC continuity，普通预览隐藏内部意图。
- memory 层使用精简 contextCore，canonical trueState 仍由 API payload 单独提供。
- 最近消息默认与运行时上限为 12，相关 Lore 在聊天历史之前分配预算。
- 页面记录 neutral / informational / progress / risk / transition 回合影响。

## 新增回归

- v1.5.1 版本与默认上下文设置。
- 旧 NPC continuity 兼容。
- claim 追加、去重与数量上限。
- NPC 关系、意图和互动摘要更新。
- 普通预览不暴露 currentIntent。
- 五类回合影响分类。
- 3 轮与 5 轮无进展节奏规则。
- NPC continuity 上下文层。
- Lore / rolling summary / recentMessages 的预算优先级。
- AI 提示明确允许空变化和无收益行动。

## 执行命令

- `node trpg-dm-assistant/build/test-security-hardening.js`
- `node trpg-dm-assistant/build/test-save-ui.js`
- `node trpg-dm-assistant/build/test-coc-outcomes.js`
- `node trpg-dm-assistant/build/test-situation-ui.js`
- `node trpg-dm-assistant/build/test-ai-json-repair.js`
- `node trpg-dm-assistant/build/test-v150-experience.js`
- `node trpg-dm-assistant/build/test-v151-investigation-stability.js`
- `node trpg-dm-assistant/build/build-single-html.js`
- `node trpg-dm-assistant/build/verify-single-html.js`
- 全部 JavaScript `node --check`
- 连续两次构建一致性、唯一产品 HTML 和 `git diff --check`
"""
(root / "reports/v1.5.1-test-report.md").write_text(report, encoding="utf-8")
