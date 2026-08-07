from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"无法定位：{label}")
    return text.replace(old, new, 1)


root = Path("trpg-dm-assistant")
ai_path = root / "src/ai-protocol.js"
ui_path = root / "src/ui.js"
ai = ai_path.read_text(encoding="utf-8")
ui = ui_path.read_text(encoding="utf-8")

# 1. 错误标题、提示词和失败详情。
ai = replace_once(
    ai,
    'LOCATION_PROPOSAL_REQUIRED:"缺少节点提议"};return map[code]',
    'LOCATION_PROPOSAL_REQUIRED:"缺少节点提议",NAVIGATION_CONFIRMATION_REQUIRED:"地点目标需要确认"};return map[code]',
    "导航确认错误标题",
)
ai = replace_once(
    ai,
    '地点变化必须使用 locationEffect + nodeProposal；普通回合 actionSuggestions 必须为 []。',
    '地点变化必须使用 locationEffect + nodeProposal；结构化模组的 targetNodeId 必须直接复制 trueState.currentNode.exits 中当前可用出口的 targetNodeId，不得留空、编造或只返回地点标题。普通回合 actionSuggestions 必须为 []。',
    "导航目标提示词",
)
ai = replace_once(
    ai,
    'errorMessage,rawResponse:state.runtime.lastRawAiResponse,at:nowIso()',
    'errorMessage,errorDetails:deepClone(error?.details||{}),rawResponse:state.runtime.lastRawAiResponse,at:nowIso()',
    "失败请求详情保存",
)

# 2. 在节点校验前加入安全出口枚举、取消与人工确认。
marker = 'function validateNodeProposal(proposal,campaignView=state.campaign,{meaningfulProgress=false}={}){'
helpers = r'''function availableNavigationChoices(current=getCurrentNode(),campaignView=state.campaign){
  const choices=[];for(const exit of current?.exits||[]){if(!exit?.targetNodeId)continue;if(exit.condition&&campaignView?.flags?.[exit.condition.flag]!==exit.condition.equals)continue;const found=findNode(exit.targetNodeId);if(!found)continue;choices.push({exitId:asString(exit.id,120),label:asString(exit.label,180)||found.node.title,targetNodeId:found.node.id,title:found.node.title})}return choices
}
function navigationFailureCandidates(failed=state.runtime.failedRequest){
  if(failed?.errorCode!=="NAVIGATION_CONFIRMATION_REQUIRED")return[];const current=availableNavigationChoices(),stored=Array.isArray(failed.errorDetails?.candidates)?failed.errorDetails.candidates:[];if(!stored.length)return current;const allowed=new Set(stored.map(item=>item?.targetNodeId).filter(Boolean));return current.filter(item=>allowed.has(item.targetNodeId))
}
function clearFailedNavigationRuntime(){state.runtime.failedRequest=null;state.runtime.lastError=null;state.runtime.lastRawAiResponse=null;state.runtime.activeRequestId=null}
function cancelFailedNavigation(){
  const failed=state.runtime.failedRequest;if(failed?.errorCode!=="NAVIGATION_CONFIRMATION_REQUIRED")return returnToActionStage();
  if(failed.playerMessageId)state.messages=state.messages.filter(message=>message.id!==failed.playerMessageId);state.runtime.pendingPlayerAction=failed.action||"";clearFailedNavigationRuntime();setPhase("awaiting_player_action",{force:true});bumpRevision();addLog("navigation","玩家取消了未确认的地点转换",{requestId:failed.requestId});scheduleAutosave();renderAll();toast("已取消本次移动，原行动已放回输入框","warn")
}
function confirmFailedNavigation(targetNodeId){
  const failed=state.runtime.failedRequest;if(failed?.errorCode!=="NAVIGATION_CONFIRMATION_REQUIRED")throw new Error("当前没有待确认的地点转换");const candidate=navigationFailureCandidates(failed).find(item=>item.targetNodeId===targetNodeId);if(!candidate)throw new Error("目标不是当前可用出口，地点未改变");
  clearFailedNavigationRuntime();state.runtime.pendingPlayerAction="";state.runtime.pendingNodeProposal={targetNodeId:candidate.targetNodeId,title:candidate.title,reason:"AI 未提供有效节点 ID，玩家从当前合法出口中明确确认",temporary:false,meaningfulProgress:false};setPhase("awaiting_player_action",{force:true});addLog("navigation",`玩家确认进入：${candidate.title}`,{requestId:failed.requestId});return confirmNodeProposal()
}
'''
if "function availableNavigationChoices(" not in ai:
    ai = replace_once(ai, marker, helpers + "\n" + marker, "导航恢复函数插入点")

# 3. 缺失节点目标改为可取消、可人工确认，而不是通用事务红错。
old_final = '  throw new Error("节点提议缺少有效目标")\n}'
new_final = '  const candidates=availableNavigationChoices(current,campaignView);throw protocolError("NAVIGATION_CONFIRMATION_REQUIRED","AI 未提供有效地点目标。请选择当前可用出口，或取消本次移动后修改行动。",{currentNodeId:current?.id||null,proposedTitle:asString(proposal?.title,120),candidates})\n}'
ai = replace_once(ai, old_final, new_final, "无效节点目标处理")
ai_path.write_text(ai, encoding="utf-8")

# 4. UI：特殊确认面板，不显示通用红色事务错误。
old_error = r'''  const failed=state.runtime.phase==="error"?state.runtime.failedRequest:null;if(failed){const raw=asString(failed.rawResponse,24000);log.insertAdjacentHTML("beforeend",`<div class="error-panel"><h3>${escapeHtml(failureTitle(failed))}</h3><p>${escapeHtml(failed.errorMessage||"AI 响应未能通过安全校验。")}</p><p class="muted">本轮 narrative、stateChanges、campaignChanges、节点和结局提议均未作为正式结果写入；事务已整体拒绝。</p>${raw?`<details><summary>查看原始 AI 响应</summary><pre class="raw-response">${escapeHtml(raw)}</pre></details>`:""}</div>`)}if(preserveOffset)log.scrollTop=Math.max(0,log.scrollHeight-oldHeight+oldTop);else if(scrollToBottom)log.scrollTop=log.scrollHeight;'''
new_error = r'''  const failed=state.runtime.phase==="error"?state.runtime.failedRequest:null;if(failed){const raw=asString(failed.rawResponse,24000),navigationFailure=failed.errorCode==="NAVIGATION_CONFIRMATION_REQUIRED";if(navigationFailure){const choices=navigationFailureCandidates(failed);log.insertAdjacentHTML("beforeend",`<div class="proposal-card"><h3>地点目标需要确认</h3><p>AI 描述了地点移动，但没有提供可验证的节点目标。该响应的叙事和状态尚未写入。</p><p class="muted">请选择当前节点的真实出口直接完成移动；不会再次调用 API。也可以取消本次移动，原行动会回到输入框。</p><div class="row" style="flex-wrap:wrap">${choices.map(item=>`<button class="btn primary" data-action="confirm-failed-navigation" data-target-node-id="${escapeHtml(item.targetNodeId)}">进入 ${escapeHtml(item.label||item.title)}</button>`).join("")||'<span class="muted">当前没有可用出口，请取消本次移动。</span>'}<button class="btn" data-action="cancel-failed-navigation">取消本次移动</button></div>${raw?`<details><summary>查看未采用的 AI 响应</summary><pre class="raw-response">${escapeHtml(raw)}</pre></details>`:""}</div>`)}else{log.insertAdjacentHTML("beforeend",`<div class="error-panel"><h3>${escapeHtml(failureTitle(failed))}</h3><p>${escapeHtml(failed.errorMessage||"AI 响应未能通过安全校验。")}</p><p class="muted">本轮 narrative、stateChanges、campaignChanges、节点和结局提议均未作为正式结果写入；事务已整体拒绝。</p>${raw?`<details><summary>查看原始 AI 响应</summary><pre class="raw-response">${escapeHtml(raw)}</pre></details>`:""}</div>`)}}if(preserveOffset)log.scrollTop=Math.max(0,log.scrollHeight-oldHeight+oldTop);else if(scrollToBottom)log.scrollTop=log.scrollHeight;'''
ui = replace_once(ui, old_error, new_error, "导航确认面板")

old_composer = 'if(retryInitial)retryInitial.classList.toggle("hidden",!(state.runtime.phase==="error"&&failed?.kind==="player_action"));if(returnAction)returnAction.classList.toggle("hidden",state.runtime.phase!=="error");'
new_composer = 'const navigationFailure=failed?.errorCode==="NAVIGATION_CONFIRMATION_REQUIRED";if(retryInitial)retryInitial.classList.toggle("hidden",!(state.runtime.phase==="error"&&failed?.kind==="player_action"&&!navigationFailure));if(returnAction)returnAction.classList.toggle("hidden",state.runtime.phase!=="error"||navigationFailure);'
ui = replace_once(ui, old_composer, new_composer, "导航错误按钮显隐")

old_delegate = 'else if(action==="reject-node")rejectNodeProposal();else if(action==="confirm-ending")confirmEndingProposal();'
new_delegate = 'else if(action==="reject-node")rejectNodeProposal();else if(action==="confirm-failed-navigation")confirmFailedNavigation(b.dataset.targetNodeId);else if(action==="cancel-failed-navigation")cancelFailedNavigation();else if(action==="confirm-ending")confirmEndingProposal();'
ui = replace_once(ui, old_delegate, new_delegate, "导航恢复事件委托")
ui_path.write_text(ui, encoding="utf-8")

# 5. 回归测试：合法出口、条件出口、取消、人工确认、无自动猜测。
test_source = r'''"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert"),{webcrypto}=require("crypto"),{TextEncoder,TextDecoder}=require("util");
const root=path.resolve(__dirname,"..");const files=["scenarios/library.js","state.js","check-engine.js","scenario-engine.js","memory.js","ai-protocol.js","saves.js"],ui=fs.readFileSync(path.join(root,"src/ui.js"),"utf8");
function storage(){const map=new Map();return{getItem:k=>map.get(String(k))??null,setItem:(k,v)=>map.set(String(k),String(v)),removeItem:k=>map.delete(String(k)),key:i=>Array.from(map.keys())[i]??null,get length(){return map.size}}}
const localStorage=storage(),sessionStorage=storage(),calls={confirm:0,toast:[]};const sandbox={Object,Array,JSON,Map,Set,console,crypto:webcrypto,TextEncoder,TextDecoder,URL,AbortController,setTimeout,clearTimeout,structuredClone,window:{localStorage,sessionStorage},document:{querySelector(){return null},querySelectorAll(){return[]},createElement(){return{click(){},remove(){},style:{}}},body:{appendChild(){}}},Blob,fetch:async()=>{throw new Error("fetch not expected")},confirm:()=>false,renderAll(){},toast:(message,type)=>calls.toast.push([message,type])};sandbox.globalThis=sandbox;
const source=files.map(file=>fs.readFileSync(path.join(root,"src",file),"utf8")).join("\n\n")+`\n;globalThis.__nav={makeInitialState,availableNavigationChoices,validateNodeProposal,navigationFailureCandidates,cancelFailedNavigation,confirmFailedNavigation};`;
vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:"navigation-recovery-test.js"});const api=sandbox.__nav;
vm.runInContext(`state=makeInitialState();state.character={system:"coc7",name:"测试角色"};state.scenario={mode:"structured",chapters:[{id:"c",scenes:[{id:"s",nodes:[{id:"hall",title:"宅邸大厅",exits:[{id:"east",label:"东侧走廊",targetNodeId:"corridor",condition:null},{id:"study-exit",label:"书房",targetNodeId:"study",condition:{flag:"studyOpen",equals:true}}]},{id:"corridor",title:"东侧走廊",exits:[]},{id:"study",title:"书房",exits:[]}]}]}]};state.campaign.currentNodeId="hall";state.campaign.currentLocation="宅邸大厅";state.campaign.flags={};`,sandbox);
let passed=0;function test(name,fn){fn();passed++;console.log(`PASS ${name}`)}
test("只枚举当前可用真实出口",()=>{const choices=api.availableNavigationChoices();assert.equal(choices.length,1);assert.equal(choices[0].targetNodeId,"corridor")});
test("条件满足后出口可用",()=>{vm.runInContext(`state.campaign.flags.studyOpen=true`,sandbox);assert.equal(api.availableNavigationChoices().length,2);vm.runInContext(`state.campaign.flags.studyOpen=false`,sandbox)});
test("缺失 targetNodeId 不自动按标题猜测",()=>{let error;try{api.validateNodeProposal({targetNodeId:"",title:"东侧走廊",reason:"移动"},sandbox.state?.campaign)}catch(e){error=e}assert.equal(error?.code,"NAVIGATION_CONFIRMATION_REQUIRED");assert.equal(error.details.candidates[0].targetNodeId,"corridor")});
test("有效 targetNodeId 正常通过",()=>{const result=api.validateNodeProposal({targetNodeId:"corridor",title:"东侧走廊",reason:"移动"},sandbox.state?.campaign);assert.equal(result.targetNodeId,"corridor")});
test("非当前出口仍严格拒绝",()=>assert.throws(()=>api.validateNodeProposal({targetNodeId:"study",title:"书房"},sandbox.state?.campaign),/没有通往目标节点的出口/));
test("取消会移除失败行动记录并恢复输入",()=>{vm.runInContext(`state.messages=[{id:"m1",role:"player",content:"去东侧走廊"}];state.runtime.failedRequest={kind:"player_action",action:"去东侧走廊",playerMessageId:"m1",requestId:"r1",errorCode:"NAVIGATION_CONFIRMATION_REQUIRED",errorDetails:{candidates:[{targetNodeId:"corridor"}]}};state.runtime.phase="error";`,sandbox);api.cancelFailedNavigation();assert.equal(vm.runInContext(`state.messages.length`,sandbox),0);assert.equal(vm.runInContext(`state.runtime.pendingPlayerAction`,sandbox),"去东侧走廊");assert.equal(vm.runInContext(`state.runtime.phase`,sandbox),"awaiting_player_action")});
test("人工确认只接受当前合法候选",()=>{vm.runInContext(`state.runtime.failedRequest={kind:"player_action",action:"去东侧走廊",requestId:"r2",errorCode:"NAVIGATION_CONFIRMATION_REQUIRED",errorDetails:{candidates:[{targetNodeId:"corridor"}]}};confirmNodeProposal=()=>{globalThis.__confirmed=state.runtime.pendingNodeProposal;return true};`,sandbox);api.confirmFailedNavigation("corridor");assert.equal(vm.runInContext(`__confirmed.targetNodeId`,sandbox),"corridor");assert.equal(vm.runInContext(`state.runtime.failedRequest`,sandbox),null)});
test("人工确认不会接受任意节点",()=>{vm.runInContext(`state.runtime.failedRequest={kind:"player_action",action:"移动",requestId:"r3",errorCode:"NAVIGATION_CONFIRMATION_REQUIRED",errorDetails:{candidates:[{targetNodeId:"corridor"}]}}`,sandbox);assert.throws(()=>api.confirmFailedNavigation("study"),/不是当前可用出口/)});
test("UI 提供取消本次移动",()=>assert.ok(ui.includes('data-action="cancel-failed-navigation"')));
test("UI 提供合法出口确认",()=>assert.ok(ui.includes('data-action="confirm-failed-navigation"')));
test("导航确认不会再次请求 API",()=>{const body=String(api.confirmFailedNavigation);assert.ok(!body.includes("requestPlayerAction")&&!body.includes("callChatCompletion"))});
console.log(`NAVIGATION_RECOVERY_TESTS:${passed}:PASS`);
'''
(root / "build/test-navigation-recovery.js").write_text(test_source, encoding="utf-8")

# 6. 同版本记录。
project_readme_path = root / "README.md"
project_readme = project_readme_path.read_text(encoding="utf-8")
marker = "## v1.4.6 更新内容\n\n"
bullet = "- 地点提议缺少有效节点目标时改为安全确认：只列出当前真实可用出口，可直接选择完成移动或取消本次移动；不自动猜节点、不采用未验证叙事、不再次调用 API。\n"
if bullet not in project_readme:
    project_readme = replace_once(project_readme, marker, marker + bullet, "项目 README v1.4.6 更新内容")
project_readme_path.write_text(project_readme, encoding="utf-8")

root_readme_path = Path("README.md")
root_readme = root_readme_path.read_text(encoding="utf-8")
ability = "- 地点目标缺失时进入安全确认，可选择当前真实出口或取消移动，避免内部节点 ID 漂移打断跑团。\n"
if ability not in root_readme:
    root_readme = replace_once(root_readme, "- AI JSON 解析加入真实脏响应语料回归，常见格式漂移由本地确定性修复处理，非法业务操作仍整体拒绝。", "- AI JSON 解析加入真实脏响应语料回归，常见格式漂移由本地确定性修复处理，非法业务操作仍整体拒绝。\n" + ability, "仓库首页能力列表")
old_record = "- v1.4.6：增加检定难度与通过线展示、等值边界校验、分层线索质量、大失败前进代价、剧情态势阶段说明，以及 AI JSON 脏响应确定性修复。"
new_record = "- v1.4.6：增加检定结果分层、剧情态势说明、AI JSON 脏响应修复，以及缺失地点目标的安全确认与取消机制。"
root_readme = replace_once(root_readme, old_record, new_record, "仓库首页 v1.4.6 版本记录")
root_readme_path.write_text(root_readme, encoding="utf-8")

report_path = root / "v1.4.6-test-report.md"
report = report_path.read_text(encoding="utf-8")
report_bullet = "- 地点 targetNodeId 缺失时不再显示通用致命事务错误；仅允许当前真实出口的人工确认，或取消并恢复原行动。\n"
if report_bullet not in report:
    report = replace_once(report, "## 修复范围\n\n", "## 修复范围\n\n" + report_bullet, "测试报告修复范围")
regression = "18. 缺失 targetNodeId 不按地点标题自动猜测。\n19. 只列出当前节点满足条件的真实出口。\n20. 取消移动移除失败行动记录并恢复原输入。\n21. 人工确认不再次调用 API，且拒绝非当前出口。\n"
if "18. 缺失 targetNodeId" not in report:
    report = replace_once(report, "17. 未知 operation 与纯自然语言仍严格拒绝。\n", "17. 未知 operation 与纯自然语言仍严格拒绝。\n" + regression, "测试报告关键回归")
command = "- `node trpg-dm-assistant/build/test-navigation-recovery.js`\n"
if command not in report:
    report = replace_once(report, "- `node trpg-dm-assistant/build/test-ai-json-repair.js`\n", "- `node trpg-dm-assistant/build/test-ai-json-repair.js`\n" + command, "测试报告执行命令")
report_path.write_text(report, encoding="utf-8")
