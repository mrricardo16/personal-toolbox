from pathlib import Path
import re

ROOT = Path("trpg-dm-assistant")


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"无法定位：{label}")
    return text.replace(old, new, 1)


def replace_regex(text, pattern, replacement, label, flags=0):
    result, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"无法唯一定位：{label}（匹配 {count}）")
    return result


# =========================
# state.js
# =========================
state_path = ROOT / "src/state.js"
state = state_path.read_text(encoding="utf-8")

old_location = 'function normalizeLocationEffect(raw){if(raw===null||raw===undefined)return{type:"stay",targetNodeId:null};if(!isPlainObject(raw)||hasDangerousKeys(raw))throw protocolError("LOCATION_EFFECT_INVALID","locationEffect 必须是对象");const type=normalizeEnum(asString(raw.type,40));if(!["stay","transition_proposal"].includes(type))throw protocolError("LOCATION_EFFECT_INVALID","locationEffect.type 只能是 stay 或 transition_proposal");return{type,targetNodeId:asString(raw.targetNodeId,120).trim()||null}}'
new_location = '''const LOCATION_EFFECT_TYPES=new Set(["stay","transition_proposal","blocked","searched","returned","uncertain"]);
function normalizeLocationEffect(raw){if(raw===null||raw===undefined)return{type:"stay",targetNodeId:null};if(!isPlainObject(raw)||hasDangerousKeys(raw))throw protocolError("LOCATION_EFFECT_INVALID","locationEffect 必须是对象");const type=normalizeEnum(asString(raw.type,40));if(!LOCATION_EFFECT_TYPES.has(type))throw protocolError("LOCATION_EFFECT_INVALID",`locationEffect.type 不受支持：${type||"未提供"}`);return{type,targetNodeId:type==="transition_proposal"?(asString(raw.targetNodeId,120).trim()||null):null}}'''
state = replace_once(state, old_location, new_location, "地点效果类型")

state = replace_regex(
    state,
    r'function validateLocationContinuity\(parsed,proposal,meaningfulProgress\)\{.*?\nfunction temporaryNodeSimilarity',
    '''function validateLocationContinuity(parsed,proposal,meaningfulProgress){
  const effect=parsed.locationEffect||{type:"stay",targetNodeId:null},implies=narrativeImpliesLocationTransition(parsed.narrative),setLocation=parsed.stateChanges?.find(change=>change.operation==="setLocation"),nonTransition=["stay","blocked","searched","returned","uncertain"].includes(effect.type);
  if(effect.type==="transition_proposal"&&!proposal)throw protocolError("LOCATION_REPAIR_REQUIRED","地点转换缺少可验证目标，需要进行内部地点校正");
  if(nonTransition&&proposal)throw protocolError("LOCATION_EFFECT_CONFLICT",`locationEffect=${effect.type} 时不得同时提交 nodeProposal`);
  if(proposal&&effect.targetNodeId&&proposal.targetNodeId&&effect.targetNodeId!==proposal.targetNodeId)throw protocolError("LOCATION_EFFECT_CONFLICT","locationEffect 与 nodeProposal 的目标节点不一致");
  if(effect.type==="stay"&&implies&&!proposal)throw protocolError("LOCATION_REPAIR_REQUIRED","叙事宣布进入新地点，但地点结果仍为 stay，需要进行内部地点校正");
  if(setLocation){if(!proposal)throw protocolError("LOCATION_SET_REQUIRES_NODE","地点变更必须通过 nodeProposal，不能单独使用 setLocation");if(asString(setLocation.location,120)!==proposal.title)throw protocolError("LOCATION_SET_CONFLICT","setLocation 必须与节点提议目标一致")}
  if(recentSpatialLoopDetected(parsed.narrative)&&!meaningfulProgress)throw protocolError("SPATIAL_LOOP_DETECTED","检测到连续重复的空间循环；本轮需要返回已有地点、让环境产生反应或结束无效搜索")
}
function temporaryNodeSimilarity''',
    "地点连续性校验",
    flags=re.S,
)

state = replace_once(
    state,
    'sceneContinuityWarning:null,turnSnapshot:null,lastUndoAt:null,lastApiSelfCheck:null}',
    'sceneContinuityWarning:null,turnSnapshot:null,requestRollback:null,lastUndoAt:null,lastApiSelfCheck:null}',
    "请求回滚运行时字段",
)
state = replace_once(
    state,
    'ui:{currentView:"setup",sidebarCollapsed:false,chatVisibleCount:100}',
    'ui:{currentView:"setup",sidebarCollapsed:false,chatVisibleCount:100,actionDraft:""}',
    "输入草稿字段",
)
state_path.write_text(state, encoding="utf-8")


# =========================
# saves.js
# =========================
saves_path = ROOT / "src/saves.js"
saves = saves_path.read_text(encoding="utf-8")
saves = replace_once(
    saves,
    '"lastRawAiResponse","turnSnapshot","lastContextEnvelope"',
    '"lastRawAiResponse","turnSnapshot","requestRollback","lastContextEnvelope"',
    "导入运行时清理",
)
saves = replace_once(
    saves,
    'snapshot.runtime.requestStartedAt=null;snapshot.runtime.turnSnapshot=null}',
    'snapshot.runtime.requestStartedAt=null;snapshot.runtime.turnSnapshot=null;snapshot.runtime.requestRollback=null}',
    "存档排除请求回滚",
)
saves = replace_once(
    saves,
    'merged.runtime.turnSnapshot=null;merged.runtime.lastApiSelfCheck=',
    'merged.runtime.turnSnapshot=null;merged.runtime.requestRollback=null;merged.runtime.lastApiSelfCheck=',
    "载入清理请求回滚",
)
saves = replace_once(
    saves,
    'merged.ui.chatVisibleCount=clamp(Number(merged.ui.chatVisibleCount||100),100,1200);',
    'merged.ui.chatVisibleCount=clamp(Number(merged.ui.chatVisibleCount||100),100,1200);merged.ui.actionDraft=asString(merged.ui.actionDraft,4000);',
    "载入输入草稿",
)
saves_path.write_text(saves, encoding="utf-8")


# =========================
# ai-protocol.js
# =========================
ai_path = ROOT / "src/ai-protocol.js"
ai = ai_path.read_text(encoding="utf-8")

ai = replace_once(
    ai,
    'LOCATION_EFFECT_CONFLICT:"地点协议冲突",LOCATION_PROPOSAL_REQUIRED:"缺少节点提议"}',
    'LOCATION_EFFECT_CONFLICT:"地点协议冲突",LOCATION_PROPOSAL_REQUIRED:"缺少节点提议",LOCATION_REPAIR_REQUIRED:"地点结果需要校正",LOCATION_REPAIR_FAILED:"地点结果校正失败"}',
    "地点校正错误标题",
)

ai = replace_once(
    ai,
    '10. 地点连续性必须服从页面节点图。每轮必须返回 locationEffect。留在当前地点时返回 {type:"stay"}；需要换地点时返回 {type:"transition_proposal",targetNodeId:"..."} 并同时提供合法 nodeProposal。不得只在 narrative 中宣布进入新的房间、走廊、地下室或地道。',
    '10. 地点连续性必须服从页面节点图。每轮必须返回 locationEffect。实际完成地点切换时使用 transition_proposal 并提供合法 nodeProposal；留在原地可使用 stay；移动受阻使用 blocked；在当前区域搜索使用 searched；绕行后回到原处使用 returned；方向或地点无法确认使用 uncertain。普通行动允许没有线索、没有进度、没有状态变化，不得为了让每轮“有意义”而硬塞房间、线索或奖励。',
    "系统提示地点规则",
)
ai = replace_once(
    ai,
    '地点变化必须使用 locationEffect + nodeProposal；普通回合 actionSuggestions 必须为 []。',
    '只有实际完成地点切换时才使用 transition_proposal + nodeProposal。stay、blocked、searched、returned、uncertain 都表示页面确认节点不变，并允许叙事没有线索或调查进展。不得在玩家可见叙事中列出后台出口或暗示唯一正确路线；普通回合 actionSuggestions 必须为 []。',
    "用户提示地点规则",
)

# 失败记录保留 details。
ai = replace_once(
    ai,
    'errorCode,errorMessage,rawResponse:state.runtime.lastRawAiResponse,at:nowIso()',
    'errorCode,errorMessage,errorDetails:deepClone(error?.details||{}),rawResponse:state.runtime.lastRawAiResponse,at:nowIso()',
    "失败详情保存",
)

# 节点内部唯一匹配与地点校正函数。
marker = 'function validateNodeProposal(proposal,campaignView=state.campaign,{meaningfulProgress=false}={}){'
helpers = r'''function normalizedLocationLabel(value){return String(value||"").toLowerCase().replace(/[\s　·•—_\-，。；：、,.!?！？()（）【】\[\]"“”'‘’]/g,"")}
function currentValidExitTargets(campaignView=state.campaign){const current=getCurrentNode(),items=[];for(const exit of current?.exits||[]){if(!exit?.targetNodeId)continue;if(exit.condition&&campaignView?.flags?.[exit.condition.flag]!==exit.condition.equals)continue;const found=findNode(exit.targetNodeId);if(found)items.push({exit,found,label:asString(exit.label,180),title:asString(found.node.title,180)})}return items}
function inferUniqueNodeTarget(proposal,campaignView=state.campaign){
  const query=normalizedLocationLabel([proposal?.title,proposal?.targetLabel,proposal?.reason].filter(Boolean).join(" "));if(!query)return null;const matches=currentValidExitTargets(campaignView).filter(item=>{const labels=[item.label,item.title].map(normalizedLocationLabel).filter(Boolean);return labels.some(label=>query===label||query.includes(label)||label.includes(query))});return matches.length===1?matches[0]:null
}
const LOCATION_REPAIR_CODES=new Set(["LOCATION_REPAIR_REQUIRED","LOCATION_PROPOSAL_REQUIRED","LOCATION_EFFECT_CONFLICT","LOCATION_SET_REQUIRES_NODE","LOCATION_SET_CONFLICT","UNDECLARED_LOCATION_TRANSITION"]);
function locationRepairImmutableView(parsed){return{decision:parsed.decision,check:parsed.check,stateChanges:parsed.stateChanges,campaignChanges:parsed.campaignChanges,endingProposal:parsed.endingProposal,actionSuggestions:parsed.actionSuggestions}}
function assertLocationRepairImmutable(before,after){if(JSON.stringify(locationRepairImmutableView(before))!==JSON.stringify(locationRepairImmutableView(after)))throw protocolError("LOCATION_REPAIR_FAILED","地点校正试图修改检定、线索、状态、剧情变化或结局，已拒绝")}
async function repairLocationProtocol(parsed,{requestId,baseRevision,stage,error}){
  const current=getCurrentNode(),internalExits=currentValidExitTargets().map(item=>({label:item.label,title:item.title,targetNodeId:item.found.node.id}));
  const prompt=`你是 TRPG 地点协议校正器，只修正地点结果与叙事连续性，不进行新的裁决。\n规则：\n1. 必须完整保留 protocolVersion、requestId、baseRevision、decision、check、stateChanges、campaignChanges、endingProposal、actionSuggestions，任何字段和值都不得改变。\n2. 只允许修改 narrative、locationEffect、nodeProposal。\n3. 玩家行动可以毫无收获。若没有真正进入新地点，使用 stay、blocked、searched、returned 或 uncertain，nodeProposal=null，并让叙事明确角色仍处于当前确认地点。\n4. 只有确实完成移动且能唯一对应内部合法出口时，才使用 transition_proposal，并原样复制对应 targetNodeId。\n5. 不得在 narrative 中枚举内部出口、提示正确方向、增加线索、NPC、伤害、张力、进度、物品或时间代价。\n6. 只返回完整 JSON。\n当前确认地点：${JSON.stringify({id:current?.id,title:current?.title})}\n后台合法出口（仅用于一致性，不得在叙事中枚举）：${JSON.stringify(internalExits)}\n原响应：${JSON.stringify(parsed)}\n校正原因：${error?.message||"地点结果不一致"}`;
  const raw=await callChatCompletion([{role:"system",content:"你只校正地点协议和叙事连续性，不能改变任何业务结果。"},{role:"user",content:prompt}],{jsonMode:true,temperature:0.1});
  const repaired=await parseAndRepairAiResponse(raw,{requestId,baseRevision,stage});assertLocationRepairImmutable(parsed,repaired);addLog("location_repair",`已在后台校正地点结果：${error?.message||"协议不一致"}`,{requestId});return repaired
}
async function prepareAiTransactionWithLocationRepair(parsed,meta,options={}){try{return prepareAiTransaction(parsed,options)}catch(error){if(!LOCATION_REPAIR_CODES.has(error?.code))throw error;let repaired;try{repaired=await repairLocationProtocol(parsed,{...meta,error})}catch(repairError){throw protocolError("LOCATION_REPAIR_FAILED",`地点结果校正失败：${repairError.message}`,{originalCode:error?.code,originalMessage:error?.message})}try{return prepareAiTransaction(repaired,options)}catch(repairError){throw protocolError("LOCATION_REPAIR_FAILED",`校正后的地点结果仍不一致：${repairError.message}`,{originalCode:error?.code,repairCode:repairError?.code})}}}

function captureRequestRollback(action){const snapshot=deepClone({...state,runtime:{...state.runtime,requestRollback:null}});state.runtime.requestRollback={action:asString(action,4000),snapshot,createdAt:nowIso()}}
function clearRequestRollback(){state.runtime.requestRollback=null}
function restoreRequestRollback(){const rollback=state.runtime.requestRollback;if(!rollback?.snapshot)return false;state=deepClone(rollback.snapshot);state.runtime.requestRollback=null;state.runtime.activeRequestId=null;state.runtime.failedRequest=null;state.runtime.lastError=null;state.runtime.lastRawAiResponse=null;state.runtime.lastContinuationPayload=null;return true}
function editFailedAction(){if(activeAbortController||state.runtime.activeRequestId)throw new Error("当前请求尚未结束");const failed=state.runtime.failedRequest;if(!failed?.action)throw new Error("没有可编辑的失败行动");const action=failed.action;restoreRequestRollback();state.ui.actionDraft=action;state.runtime.pendingPlayerAction="";setPhase("awaiting_player_action",{force:true});bumpRevision();addLog("recovery","失败行动已恢复到输入框供编辑");renderAll();$("#playerAction")?.focus()}
function discardFailedTurn(){if(activeAbortController||state.runtime.activeRequestId)throw new Error("当前请求尚未结束");if(!state.runtime.failedRequest)throw new Error("没有可放弃的失败回合");restoreRequestRollback();state.ui.actionDraft="";state.runtime.pendingPlayerAction="";setPhase("awaiting_player_action",{force:true});bumpRevision();addLog("recovery","已放弃未生效回合并恢复请求前状态");renderAll();toast("本轮未生效内容已放弃","warn")}
'''
if "function repairLocationProtocol(" not in ai:
    ai = replace_once(ai, marker, helpers + "\n" + marker, "地点校正与请求恢复函数")

# 替换 validateNodeProposal 的开头，使标题可在后台唯一映射，绝不展示出口。
ai = replace_once(
    ai,
    '  if(!proposal)return null;const current=getCurrentNode();if(!current)throw new Error("当前节点不存在");\n  if(proposal.targetNodeId){const found=findNode(proposal.targetNodeId);if(!found)throw new Error("提议的目标节点不存在");if(state.scenario.mode==="structured"){const exit=(current.exits||[]).find(e=>e.targetNodeId===proposal.targetNodeId);if(!exit)throw new Error("当前节点没有通往目标节点的出口");if(exit.condition){const actual=campaignView.flags[exit.condition.flag];if(actual!==exit.condition.equals)throw new Error("节点出口条件未满足")}}return{targetNodeId:proposal.targetNodeId,title:found.node.title,reason:proposal.reason,temporary:false,meaningfulProgress}}',
    '  if(!proposal)return null;const current=getCurrentNode();if(!current)throw new Error("当前节点不存在");\n  let targetNodeId=asString(proposal.targetNodeId,120);let found=targetNodeId?findNode(targetNodeId):null;if((!found||state.scenario.mode==="structured"&&!(current.exits||[]).some(exit=>exit.targetNodeId===targetNodeId))&&state.scenario.mode==="structured"){const inferred=inferUniqueNodeTarget(proposal,campaignView);if(inferred){targetNodeId=inferred.found.node.id;found=inferred.found}}\n  if(targetNodeId&&found){if(state.scenario.mode==="structured"){const exit=(current.exits||[]).find(e=>e.targetNodeId===targetNodeId);if(!exit)throw protocolError("LOCATION_REPAIR_REQUIRED","当前节点没有通往提议目标的出口");if(exit.condition){const actual=campaignView.flags[exit.condition.flag];if(actual!==exit.condition.equals)throw protocolError("LOCATION_REPAIR_REQUIRED","节点出口条件未满足")}}return{targetNodeId,title:found.node.title,reason:proposal.reason,temporary:false,meaningfulProgress}}',
    "后台唯一地点映射",
)
ai = replace_once(
    ai,
    '  throw new Error("节点提议缺少有效目标")\n}',
    '  throw protocolError("LOCATION_REPAIR_REQUIRED","节点提议缺少可验证目标，需要进行内部地点校正")\n}',
    "无效地点目标转校正",
)

# 发送草稿立即清空，并在首次行动前保存请求级回滚快照。
ai = replace_once(
    ai,
    'async function submitPlayerAction(action){return requestPlayerAction(action,{appendPlayerMessage:true})}',
    'async function submitPlayerAction(action){state.ui.actionDraft="";const input=$("#playerAction");if(input)input.value="";renderChatComposer();return requestPlayerAction(action,{appendPlayerMessage:true})}',
    "发送后清空输入框",
)
ai = replace_once(
    ai,
    '  if(appendPlayerMessage){captureTurnSnapshot(action);',
    '  if(appendPlayerMessage){captureRequestRollback(action);captureTurnSnapshot(action);',
    "请求前回滚快照",
)

# 两处事务准备改为可进行一次受限地点校正。
ai = ai.replace(
    'const parsed=await parseAndRepairAiResponse(raw,{requestId,baseRevision,stage});',
    'let parsed=await parseAndRepairAiResponse(raw,{requestId,baseRevision,stage});',
)
if ai.count('let parsed=await parseAndRepairAiResponse(raw,{requestId,baseRevision,stage});') < 2:
    raise RuntimeError("未能替换两处 parsed 声明")
ai = ai.replace(
    'const transaction=prepareAiTransaction(parsed);state.runtime.processedRequestIds.push(requestId);',
    'const transaction=await prepareAiTransactionWithLocationRepair(parsed,{requestId,baseRevision,stage});parsed=transaction.parsed;state.runtime.processedRequestIds.push(requestId);',
    1,
)
ai = ai.replace(
    'const transaction=prepareAiTransaction(parsed,{currentCheckRecordId:record.id});state.runtime.processedRequestIds.push(requestId);',
    'const transaction=await prepareAiTransactionWithLocationRepair(parsed,{requestId,baseRevision,stage},{currentCheckRecordId:record.id});parsed=transaction.parsed;state.runtime.processedRequestIds.push(requestId);',
    1,
)

# 最终成功才清除回滚；进入检定链时继续保留。
ai = replace_once(
    ai,
    'state.runtime.activeRequestId=null;state.runtime.pendingPlayerAction="";setPhase(transaction.ending?',
    'state.runtime.activeRequestId=null;state.runtime.pendingPlayerAction="";clearRequestRollback();setPhase(transaction.ending?',
    "初始请求完成清理回滚",
)
ai = replace_once(
    ai,
    'state.runtime.currentResolutionRecordId=null;state.runtime.pendingPlayerAction="";state.runtime.checkChainDepth=0;',
    'state.runtime.currentResolutionRecordId=null;state.runtime.pendingPlayerAction="";state.runtime.checkChainDepth=0;clearRequestRollback();',
    "续写完成清理回滚",
)

# 旧返回行动阶段改为编辑后重发语义。
ai = replace_regex(
    ai,
    r'function returnToActionStage\(\)\{.*?\n\}',
    'function returnToActionStage(){return editFailedAction()}',
    "返回行动阶段兼容函数",
    flags=re.S,
)

# 取消请求也进入统一恢复卡，不能留下半个回合。
ai = replace_regex(
    ai,
    r'function cancelActiveRequest\(\)\{.*?\n\}',
    '''function cancelActiveRequest(){
  const phase=state.runtime.phase,wasContinuation=phase==="requesting_ai_continuation",requestId=state.runtime.activeRequestId,controller=activeAbortController;if(controller)controller.abort("user");if(activeAbortController===controller)activeAbortController=null;state.runtime.activeRequestId=null;const action=state.runtime.pendingPlayerAction||state.runtime.requestRollback?.action||"",playerMessageId=state.messages.filter(message=>message.role==="player").at(-1)?.id||null,recordId=state.runtime.lastContinuationPayload?.recordId||null;
  recordRequestFailure({kind:wasContinuation?"continuation":"player_action",action,playerMessageId,recordId,requestId,stage:wasContinuation?"check_continuation":"action_adjudication",rawResponse:"",error:protocolError(wasContinuation?"CONTINUATION_REQUEST_FAILED":"INITIAL_REQUEST_FAILED","请求已由用户取消")})
}''',
    "取消请求统一恢复",
    flags=re.S,
)

ai_path.write_text(ai, encoding="utf-8")


# =========================
# ui.js
# =========================
ui_path = ROOT / "src/ui.js"
ui = ui_path.read_text(encoding="utf-8")

ui = replace_once(
    ui,
    '${escapeHtml(state.runtime.pendingPlayerAction||"")}</textarea>',
    '${escapeHtml(state.ui.actionDraft||"")}</textarea>',
    "输入框使用独立草稿",
)
ui = replace_once(
    ui,
    '<button id="retryInitialRequestBtn" class="btn hidden" type="button">重新请求本轮</button><button id="retryContinuationBtn" class="btn hidden" type="button">重新请求续写</button><button id="returnActionStageBtn" class="btn hidden" type="button">返回行动阶段</button>',
    '',
    "移除底部重复恢复按钮",
)

# 错误面板改为恢复卡。
ui = replace_regex(
    ui,
    r'  const failed=state\.runtime\.phase==="error"\?state\.runtime\.failedRequest:null;if\(failed\)\{.*?\}if\(preserveOffset\)',
    '''  const failed=state.runtime.phase==="error"?state.runtime.failedRequest:null;if(failed){const raw=asString(failed.rawResponse,24000),continuation=failed.kind==="continuation",debug=Boolean(state.config.kpDebug);log.insertAdjacentHTML("beforeend",`<div class="proposal-card recovery-card"><h3>本轮未生效</h3><p>${escapeHtml(failed.errorMessage||"主持响应未能通过校验，游戏状态没有改变。")}</p><p class="muted">玩家行动已保存在内部恢复快照中。输入框保持空白，避免重复发送。</p><div class="row" style="flex-wrap:wrap"><button class="btn primary" data-action="retry-failed-turn">${continuation?"沿用原骰点重试":"重试原行动"}</button><button class="btn" data-action="edit-failed-turn">编辑后重发</button><button class="btn" data-action="discard-failed-turn">放弃本轮</button></div>${raw?`<details><summary>技术详情${debug&&failed.errorCode?` · ${escapeHtml(failed.errorCode)}`:""}</summary><pre class="raw-response">${escapeHtml(raw)}</pre></details>`:""}</div>`)}if(preserveOffset)''',
    "错误恢复卡",
    flags=re.S,
)

# Composer 仅控制取消请求，不再寻找已经移除的旧按钮。
ui = replace_regex(
    ui,
    r'const cancel=\$\("#cancelRequestBtn"\),retryContinuation=.*?if\(returnAction\)returnAction\.classList\.toggle\("hidden",state\.runtime\.phase!=="error"\);',
    'const cancel=$("#cancelRequestBtn");if(cancel)cancel.classList.toggle("hidden",!activeAbortController);',
    "输入区恢复按钮显隐",
    flags=re.S,
)

# 每次重绘后同步草稿。
ui = replace_once(
    ui,
    '  const cancel=$("#cancelRequestBtn");if(cancel)cancel.onclick=cancelActiveRequest;',
    '  const actionInput=$("#playerAction");if(actionInput)actionInput.oninput=()=>{state.ui.actionDraft=actionInput.value};\n  const cancel=$("#cancelRequestBtn");if(cancel)cancel.onclick=cancelActiveRequest;',
    "输入草稿事件",
)

# 委托恢复卡操作。
ui = replace_once(
    ui,
    'else if(action==="reject-node")rejectNodeProposal();else if(action==="confirm-ending")confirmEndingProposal();',
    'else if(action==="reject-node")rejectNodeProposal();else if(action==="retry-failed-turn"){const failed=state.runtime.failedRequest;(failed?.kind==="continuation"?retryContinuation():retryInitialRequest()).catch(err=>toast(err.message,"danger"))}else if(action==="edit-failed-turn")editFailedAction();else if(action==="discard-failed-turn")discardFailedTurn();else if(action==="confirm-ending")confirmEndingProposal();',
    "恢复卡事件委托",
)
ui_path.write_text(ui, encoding="utf-8")


# =========================
# Version + docs
# =========================
library_path = ROOT / "src/scenarios/library.js"
library = library_path.read_text(encoding="utf-8")
library = replace_once(library, 'const APP_VERSION = "1.4.6";', 'const APP_VERSION = "1.5.0";', "APP_VERSION")
library_path.write_text(library, encoding="utf-8")

project_readme_path = ROOT / "README.md"
project_readme = project_readme_path.read_text(encoding="utf-8")
project_readme = re.sub(r'^# TRPG AI 主持助手 v[^\n]+', '# TRPG AI 主持助手 v1.5.0', project_readme, count=1, flags=re.M)
project_readme = re.sub(r'当前版本为 v[^。]+。', '当前版本为 v1.5.0。', project_readme, count=1)
section = '''## v1.5.0 更新内容

- 重构玩家输入生命周期：发送后输入框立即清空，内部行动快照与可编辑草稿彻底分离。
- 请求失败改为“本轮未生效”恢复卡，提供重试原行动、编辑后重发、放弃本轮；原始响应默认折叠为技术详情。
- 编辑或放弃失败回合会恢复请求前完整状态，避免网络或协议错误消耗回合、推进张力或留下检定记录。
- 地点结果新增 blocked、searched、returned、uncertain；单次行动允许没有线索、没有进度和没有奖励。
- 后台可按地点标题唯一匹配内部节点，但不会向玩家展示真实出口或正确路线。
- 地点协议不一致时只允许一次低温度校正；校正只能修改 narrative、locationEffect、nodeProposal，不能修改检定、线索、状态、剧情变化或结局。
- 新增输入恢复、请求回滚、地点校正不可变字段和无意义行动回归测试。

'''
if "## v1.5.0 更新内容" not in project_readme:
    project_readme = project_readme.replace("## v1.4.6 更新内容", section + "## v1.4.6 更新内容", 1)
project_readme = project_readme.replace("## 版本记录\n\n", "## 版本记录\n\n- v1.5.0：重构输入失败恢复与地点响应协议，允许无进展行动，并以受限后台校正保持场景连续性。\n", 1)
project_readme = project_readme.replace("`src/`：v1.4.6", "`src/`：v1.5.0")
project_readme = project_readme.replace("- `v1.4.6-test-report.md`：当前版本测试报告。", "- `v1.5.0-test-report.md`：当前版本测试报告。\n- `v1.4.6-test-report.md`：上一版本测试报告。")
project_readme_path.write_text(project_readme, encoding="utf-8")

root_readme_path = Path("README.md")
root_readme = root_readme_path.read_text(encoding="utf-8")
root_readme = re.sub(r'### TRPG AI 主持助手（最新版 v[^）]+）', '### TRPG AI 主持助手（最新版 v1.5.0）', root_readme, count=1)
ability = "- 玩家行动发送后立即清空输入框；失败回合可重试、编辑或放弃，并恢复请求前完整状态。\n- 地点图保持后台不可见，允许无进展探索；地点协议校正不会向玩家暴露真实出口或唯一正确路线。\n"
if ability not in root_readme:
    root_readme = root_readme.replace("版本记录：", ability + "\n版本记录：", 1)
root_readme = root_readme.replace("版本记录：\n\n", "版本记录：\n\n- v1.5.0：重构输入失败恢复、回合回滚和 AI 主持式地点响应。\n", 1)
root_readme_path.write_text(root_readme, encoding="utf-8")


# =========================
# Regression tests
# =========================
test_source = r'''"use strict";
const fs=require("fs"),path=require("path"),assert=require("assert");
const root=path.resolve(__dirname,"..");
const state=fs.readFileSync(path.join(root,"src/state.js"),"utf8"),ai=fs.readFileSync(path.join(root,"src/ai-protocol.js"),"utf8"),ui=fs.readFileSync(path.join(root,"src/ui.js"),"utf8"),saves=fs.readFileSync(path.join(root,"src/saves.js"),"utf8"),library=fs.readFileSync(path.join(root,"src/scenarios/library.js"),"utf8");
let passed=0;function test(name,fn){fn();passed++;console.log(`PASS ${name}`)}
test("版本升级为 v1.5.0",()=>assert.ok(library.includes('const APP_VERSION = "1.5.0";')));
test("输入框使用独立 actionDraft",()=>assert.ok(ui.includes('state.ui.actionDraft||""')));
test("发送动作立即清空草稿",()=>assert.match(ai,/submitPlayerAction\(action\)\{state\.ui\.actionDraft=""/));
test("输入事件持续同步草稿",()=>assert.ok(ui.includes('actionInput.oninput=()=>{state.ui.actionDraft=actionInput.value}')));
test("失败恢复卡提供重试编辑放弃",()=>{for(const action of ["retry-failed-turn","edit-failed-turn","discard-failed-turn"])assert.ok(ui.includes(action))});
test("旧的底部恢复按钮已移除",()=>assert.ok(!ui.includes('id="retryInitialRequestBtn"')));
test("请求前保存完整回滚快照",()=>assert.ok(ai.includes('captureRequestRollback(action);captureTurnSnapshot(action)')));
test("编辑和放弃会恢复请求前状态",()=>{assert.ok(ai.includes('function editFailedAction()'));assert.ok(ai.includes('function discardFailedTurn()'));assert.ok(ai.includes('restoreRequestRollback()'))});
test("请求回滚不进入存档",()=>assert.ok(saves.includes('snapshot.runtime.requestRollback=null')));
test("地点支持无进展结果",()=>{for(const type of ["blocked","searched","returned","uncertain"])assert.ok(state.includes(`"${type}"`))});
test("无进展地点结果不要求节点提议",()=>assert.ok(state.includes('nonTransition=["stay","blocked","searched","returned","uncertain"]')));
test("后台唯一地点映射不渲染出口菜单",()=>{assert.ok(ai.includes('function inferUniqueNodeTarget'));assert.ok(!ui.includes('当前可用出口'));assert.ok(!ui.includes('confirm-failed-navigation'))});
test("地点校正限制不可变业务字段",()=>assert.ok(ai.includes('assertLocationRepairImmutable(parsed,repaired)')));
test("地点校正温度固定为 0.1",()=>assert.ok(ai.includes('jsonMode:true,temperature:0.1')));
test("初始和续写链路都使用地点校正事务",()=>assert.equal((ai.match(/prepareAiTransactionWithLocationRepair\(/g)||[]).length>=3,true));
test("系统提示允许没有奖励的行动",()=>assert.match(ai,/普通行动允许没有线索、没有进度、没有状态变化/));
test("技术详情默认折叠",()=>assert.ok(ui.includes('<details><summary>技术详情'));
test("取消请求进入统一失败恢复",()=>assert.match(ai,/function cancelActiveRequest\(\)[\s\S]*recordRequestFailure/));
console.log(`V150_EXPERIENCE_TESTS:${passed}:PASS`);
'''
(ROOT / "build/test-v150-experience.js").write_text(test_source, encoding="utf-8")

report = '''# TRPG DM Assistant v1.5.0 测试报告

## 发布目标

修复输入框重复旧行动、失败恢复不明确、地点节点错误阻断游玩，以及“展示真实出口”可能泄露模组结构的问题。

## 交互规则

- 发送后输入框立即清空；内部请求快照不再直接渲染到输入框。
- 请求失败不写入 AI 叙事与状态，显示紧凑恢复卡。
- 重试不会重复玩家消息；编辑与放弃会恢复请求前完整状态。
- 玩家不会看到后台节点 ID、出口候选或正确路线。
- 玩家可以进行无意义、无收获或受阻的行动。
- 地点校正最多调用一次，只能修改叙事和地点协议字段。

## 回归测试

1. v1.5.0 版本标记。
2. actionDraft 与 pendingPlayerAction 分离。
3. 发送后立即清空输入框。
4. 恢复卡重试、编辑、放弃操作。
5. 请求级完整状态回滚。
6. requestRollback 不进入存档。
7. blocked、searched、returned、uncertain 地点结果。
8. 无进展行动不强制节点切换。
9. 后台唯一节点匹配不渲染出口菜单。
10. 地点校正不可修改业务字段。
11. 初始请求和检定续写均应用地点校正。
12. 取消请求也进入统一恢复流程。

## 执行命令

- `node trpg-dm-assistant/build/test-security-hardening.js`
- `node trpg-dm-assistant/build/test-save-ui.js`
- `node trpg-dm-assistant/build/test-coc-outcomes.js`
- `node trpg-dm-assistant/build/test-situation-ui.js`
- `node trpg-dm-assistant/build/test-ai-json-repair.js`
- `node trpg-dm-assistant/build/test-v150-experience.js`
- `node trpg-dm-assistant/build/build-single-html.js`
- `node trpg-dm-assistant/build/verify-single-html.js`
- 全部 JavaScript `node --check`
- 连续两次构建 SHA-256 一致性校验
- 唯一产品 HTML 检查
- `git diff --check`
'''
(ROOT / "v1.5.0-test-report.md").write_text(report, encoding="utf-8")
