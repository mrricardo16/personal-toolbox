from pathlib import Path

ROOT=Path('.')
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')
def once(s,a,b,label):
    if s.count(a)!=1: raise SystemExit(f'{label}: expected 1 anchor, got {s.count(a)}')
    return s.replace(a,b,1)
def between(s,a,b,new,label):
    i=s.find(a); j=s.find(b,i)
    if i<0 or j<0: raise SystemExit(f'{label}: anchor missing')
    return s[:i]+new.rstrip()+'\n'+s[j:]

p='trpg-dm-assistant/src/scenarios/library.js'; s=read(p); s=once(s,'const APP_VERSION = "1.5.1";','const APP_VERSION = "1.5.2";','version'); write(p,s)
p='trpg-dm-assistant/src/state.js'; s=read(p); s=once(s,'lastTurnImpact:null','lastTurnImpact:null,lastNarrativeRepetition:null,lastWorldContinuityEvent:null,longSessionDiagnostics:null','runtime'); write(p,s)

p='trpg-dm-assistant/src/scenario-engine.js'; s=read(p)
helper=r'''
const MAX_WORLD_CONTINUITY_EVENTS=12;
const MAX_NARRATIVE_HISTORY=8;
function ensureWorldContinuityState(director=state.campaign?.directorState){
  if(!isPlainObject(director))director={};
  director.worldEvents=Array.isArray(director.worldEvents)?director.worldEvents.filter(isPlainObject).slice(-MAX_WORLD_CONTINUITY_EVENTS):[];
  director.narrativeHistory=Array.isArray(director.narrativeHistory)?director.narrativeHistory.filter(isPlainObject).slice(-MAX_NARRATIVE_HISTORY):[];
  director.lastWorldChangeTurn=Number.isFinite(Number(director.lastWorldChangeTurn))?Number(director.lastWorldChangeTurn):-1;
  return director
}
function narrativeFingerprintTokens(value){
  const text=String(value||"").toLowerCase().replace(/[\s　，。；：、,.!?！？"'“”‘’（）()\[\]【】—_\-]+/g,"");
  const tokens=new Set();for(let i=0;i<text.length-1&&tokens.size<240;i++)tokens.add(text.slice(i,i+2));return tokens
}
function narrativeSimilarity(a,b){const aa=a instanceof Set?a:narrativeFingerprintTokens(a),bb=b instanceof Set?b:narrativeFingerprintTokens(b);if(!aa.size||!bb.size)return 0;let common=0;for(const token of aa)if(bb.has(token))common++;return common/(aa.size+bb.size-common)}
function narrativeRepetitionScore(narrative,director=state.campaign?.directorState){const text=asString(narrative,12000).trim();if(text.length<50)return{score:0,matches:0,repeated:false};const d=ensureWorldContinuityState(director),tokens=narrativeFingerprintTokens(text);let score=0,matches=0;for(const item of d.narrativeHistory.slice(-6)){const current=narrativeSimilarity(tokens,new Set(item.tokens||[]));score=Math.max(score,current);if(current>=0.72)matches++}return{score:Number(score.toFixed(3)),matches,repeated:score>=0.82||matches>=2}}
function worldEventSummary(transaction){const summaries=(transaction?.prepared?.summaries||[]).map(x=>asString(x,240)).filter(Boolean);if(summaries.length)return summaries.slice(0,4).join("；");return asString(transaction?.parsed?.narrative,260).replace(/\s+/g," ").trim()}
function recordWorldContinuityEvent(transaction,requestId){const d=ensureWorldContinuityState(state.campaign.directorState={...defaultDirectorState(),...(state.campaign.directorState||{})}),turn=Number(d.totalTurns||0),impact=transaction?.turnImpact||"neutral",narrative=asString(transaction?.parsed?.narrative,12000),repeat=narrativeRepetitionScore(narrative,d);if(narrative){d.narrativeHistory.push({turn,tokens:Array.from(narrativeFingerprintTokens(narrative)).slice(0,240),impact});if(d.narrativeHistory.length>MAX_NARRATIVE_HISTORY)d.narrativeHistory.splice(0,d.narrativeHistory.length-MAX_NARRATIVE_HISTORY)}const event={turn,impact,location:asString(state.campaign.currentLocation||getCurrentNode()?.title,160),summary:worldEventSummary(transaction),requestId:requestId||null};d.worldEvents.push(event);if(d.worldEvents.length>MAX_WORLD_CONTINUITY_EVENTS)d.worldEvents.splice(0,d.worldEvents.length-MAX_WORLD_CONTINUITY_EVENTS);if(impact!=="neutral")d.lastWorldChangeTurn=turn;state.runtime.lastNarrativeRepetition=repeat;state.runtime.lastWorldContinuityEvent=event;return event}
function actionTemporalIntent(value){const text=String(value||"");if(!text.trim())return"normal";if(/(?:等|等待|守着|休息|睡|过夜|待到|坐一会|发呆|什么都不做|十分钟|半小时|一小时|几小时)/u.test(text))return"wait";if(/(?:仔细|彻底|反复|重新|再搜|翻遍|长时间).{0,8}(?:搜|查|观察|检查|调查)/u.test(text))return"extended_search";return"normal"}
function worldContinuityContext({debug=false}={}){const d=ensureWorldContinuityState(state.campaign?.directorState||{}),stalled=Math.max(0,Number(d.sceneTurns||0)-Number(d.lastProgressTurn||0));const base={turnClock:{sceneTurns:Number(d.sceneTurns||0),totalTurns:Number(d.totalTurns||0),stalledTurns:stalled,lastProgressTurn:Number(d.lastProgressTurn||0),lastWorldChangeTurn:Number(d.lastWorldChangeTurn??-1)},recentEvents:d.worldEvents.slice(-8).map(({requestId,...event})=>event),lastTurnImpact:state.runtime?.lastTurnImpact||null};if(debug)base.repetition=state.runtime?.lastNarrativeRepetition||null;return base}
function selectRecentMessagesForContext(messages,limit,charBudget){const source=(Array.isArray(messages)?messages:[]).slice(-Math.max(1,limit)).map(message=>({role:message.role,content:asString(message.content,12000)})),selected=[];let used=0;for(let i=source.length-1;i>=0;i--){const size=countChars(source[i]);if(selected.length&&used+size>charBudget)break;if(!selected.length&&size>charBudget){selected.unshift({role:source[i].role,content:source[i].content.slice(-Math.max(0,charBudget-40))});break}selected.unshift(source[i]);used+=size}return selected}
'''
if 'const MAX_WORLD_CONTINUITY_EVENTS=12;' not in s:
    s=once(s,'function pacingDirective()',helper.rstrip()+'\nfunction pacingDirective()','helper insert')
new_pacing=r'''function pacingDirective(){
  const d=ensureWorldContinuityState(state.campaign?.directorState||defaultDirectorState()),stalled=Number(d.sceneTurns||0)-Number(d.lastProgressTurn||0),event=state.runtime.pendingDirectorEvent,repeat=state.runtime?.lastNarrativeRepetition;
  const repetition=repeat?.repeated?" 最近叙事与前几轮过于相似；不要换词复述同一异常，应让既有世界保持静默、产生不同但合理的反应，或明确告诉玩家没有新变化。":"";
  if(event?.kind==="climax_gate"||Number(d.tension||1)>=6)return"张力已经达到高潮阈值。让既有威胁进入危机、撤退或结局窗口，不得继续添加无关谜团。"+repetition;
  if(event?.kind==="pressure"||stalled>=5)return"世界必须主动变化：优先让已有 NPC 按当前意图行动、推进既有威胁/时钟、体现时间流逝或改变环境条件。可以造成代价，但不得为了推进而强送关键线索、正确答案、新房间或新 NPC。"+repetition;
  if(event?.kind==="environment_shift"||stalled>=3)return"连续数轮没有实质推进仍是合法调查节奏。可以加入轻微且来源明确的环境变化、NPC 动作或时间感；也可以明确没有新发现。不要强制线索、奖励、检定或进度。"+repetition;
  return"允许无收益行动；世界可以保持静默。只有既有事实、NPC 动机或威胁确实要求变化时才推进世界；关键线索不得只有唯一获取路径。"+repetition
}
'''
s=between(s,'function pacingDirective()','function buildContextSnapshot(',new_pacing,'pacing')
new_context=r'''function buildContextSnapshot(extraText="",{debug=false}={}){
  const budget=currentContextBudget(),lore=getTriggeredLoreCards(extraText),publicChecks=state.checkRecords.filter(record=>debug||(!record.hiddenFromPlayer&&record.visibility!=="secret")).slice(-6),recentLimit=Math.min(12,clamp(Number(state.context?.recentMessageLimit||12),4,12)),temporalIntent=actionTemporalIntent(extraText);
  let rolling=asString(state.context.rollingSummary,8000),activeLore=lore.map(card=>({id:card.id,title:card.title,content:debug||card.visibility==="player"?card.content:"[主持资料已触发，普通预览隐藏正文]",visibility:card.visibility,matchedTriggers:card.matchedTriggers}));
  const fixed={systemRules:{style:state.config.narrativeStyle,boundaries:state.config.contentBoundaries,strictness:state.config.ruleStrictness},trueState:safeContextCoreState(),currentScene:getCurrentNode(),pinnedFacts:listStrings(state.context.pinnedFacts,50,500),activeLeads:(state.campaign.activeLeads||[]).filter(item=>item.status!=="resolved"),unresolvedQuestions:(state.campaign.unresolvedQuestions||[]).filter(item=>item.status!=="resolved"),npcContinuity:npcContinuityContext({debug}),worldContinuity:worldContinuityContext({debug}),temporalIntent,directorNote:state.context.directorNote||{},recentChecks:publicChecks,playerAction:extraText,pacingDirective:pacingDirective(),directorEvent:state.runtime.pendingDirectorEvent};
  if(debug){fixed.scenarioDirector=state.scenario?.director||null;fixed.secretChecks=state.checkRecords.filter(record=>record.visibility==="secret"||record.hiddenFromPlayer).slice(-12)}
  let used=countChars(fixed),remaining=Math.max(0,budget.total-used),loreAllowance=Math.min(remaining,Math.max(0,budget.lore));while(activeLore.length&&countChars(activeLore)>loreAllowance)activeLore.pop();remaining=Math.max(0,remaining-countChars(activeLore));
  const rollingAllowance=Math.min(8000,Math.floor(remaining*.38));if(rolling.length>rollingAllowance)rolling=rolling.slice(-rollingAllowance);remaining=Math.max(0,remaining-rolling.length);
  const recentBudget=Math.max(0,remaining),recent=selectRecentMessagesForContext(state.messages,recentLimit,recentBudget),droppedRecent=Math.max(0,Math.min(state.messages.length,recentLimit)-recent.length);
  const layers={...fixed,activeLoreCards:activeLore,rollingSummary:rolling,recentMessages:recent};const metrics={};for(const [key,value] of Object.entries(layers))metrics[key]=countChars(value);metrics.total=Object.values(metrics).reduce((a,b)=>a+b,0);metrics.budget=budget.total;metrics.overBudget=Math.max(0,metrics.total-budget.total);
  const diagnostics={priorityOrder:["playerAction","trueState","currentScene","pinnedFacts","activeLeads","unresolvedQuestions","npcContinuity","worldContinuity","activeLoreCards","rollingSummary","recentMessages"],recentLimit,recentIncluded:recent.length,droppedRecent,loreIncluded:activeLore.length,npcContinuityIncluded:fixed.npcContinuity.length,worldEventsIncluded:fixed.worldContinuity.recentEvents.length,temporalIntent,lastTurnImpact:state.runtime?.lastTurnImpact||null,repetition:debug?(state.runtime?.lastNarrativeRepetition||null):undefined};
  state.runtime.longSessionDiagnostics=diagnostics;return{...layers,metrics,diagnostics:debug?diagnostics:undefined,loreSelection:state.runtime.lastLoreSelection||[]}
}
'''
s=between(s,'function buildContextSnapshot(','function endingConditionMatches',new_context,'context')
write(p,s)
print('v1.5.2 core patch applied')
