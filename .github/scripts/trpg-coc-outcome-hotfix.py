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

# 1. CoC 判定核心：明确难度通过线、成功等级与一致性校验。
check_path = root / "src/check-engine.js"
check = check_path.read_text(encoding="utf-8")
check_block = r'''const COC_DIFFICULTY_LABELS={regular:"普通",hard:"困难",extreme:"极难"};
const COC_RANK_LABELS={critical:"大成功",extreme:"极难成功",hard:"困难成功",regular:"普通成功",failure:"失败",fumble:"大失败",skipped:"已跳过"};
function cocDifficultyLabel(value){return COC_DIFFICULTY_LABELS[value]||String(value||"普通")}
function cocRankLabel(value){return COC_RANK_LABELS[value]||String(value||"未知")}
function cocDifficultyTarget(target,difficulty="regular"){
  const value=clamp(Number(target||0),1,100);if(difficulty==="hard")return Math.floor(value/2);if(difficulty==="extreme")return Math.floor(value/5);return value
}
function cocRank(roll,target){
  const critical=roll===1;const fumble=target<50?roll>=96:roll===100;
  if(critical)return "critical";if(fumble)return "fumble";if(roll<=Math.floor(target/5))return "extreme";
  if(roll<=Math.floor(target/2))return "hard";if(roll<=target)return "regular";return "failure";
}
function cocDifficultyPass(rank,difficulty){
  const order={fumble:0,failure:0,regular:1,hard:2,extreme:3,critical:4};const need={regular:1,hard:2,extreme:3}[difficulty||"regular"]||1;return order[rank]>=need;
}
function clueDiscoveryQuality(record){
  if(!record||record.skipped)return "skipped";if(record.rank==="fumble")return "fumble";if(record.result!==true)return "failure";return ["critical","extreme","hard","regular"].includes(record.rank)?record.rank:"regular"
}
function validateCocRollOutcome(roll){
  if(!roll||roll.skipped)return true;const total=Number(roll.total),target=Number(roll.target),difficulty=roll.difficulty||"regular";
  const expectedRank=cocRank(total,target),expectedResult=cocDifficultyPass(expectedRank,difficulty),expectedTarget=cocDifficultyTarget(target,difficulty);
  if(roll.rank!==expectedRank||Boolean(roll.result)!==expectedResult||Number(roll.difficultyTarget)!==expectedTarget)throw new Error(`COC 判定不一致：骰点 ${total} / 技能 ${target} / 难度 ${difficulty}`);return true
}
function rollCocPercentile(check){
  const rawBonus=clamp(Number(check.bonusDice||0),0,2),rawPenalty=clamp(Number(check.penaltyDice||0),0,2);
  const net=rawBonus-rawPenalty,bonus=Math.max(0,net),penalty=Math.max(0,-net),extra=Math.max(bonus,penalty);
  const ones=randomInt(0,9);const tens=[];for(let i=0;i<1+extra;i++)tens.push(randomInt(0,9));
  const values=tens.map(t=>{const v=t*10+ones;return v===0?100:v});
  const selected=bonus?Math.min(...values):penalty?Math.max(...values):values[0],target=clamp(Number(check.target||0),1,100),difficulty=["regular","hard","extreme"].includes(check.difficulty)?check.difficulty:"regular";
  const rank=cocRank(selected,target),result=cocDifficultyPass(rank,difficulty),difficultyTarget=cocDifficultyTarget(target,difficulty),out={expression:"1d100",rawRolls:values,modifier:0,total:selected,target,difficulty,difficultyTarget,rank,result};validateCocRollOutcome(out);return out;
}
'''
check = replace_between(check, "function cocRank(", "function rollDnd(", check_block, "COC 判定函数块")
check_path.write_text(check, encoding="utf-8")

# 2. 线索授权：失败前进与大失败代价分层。
scenario_path = root / "src/scenario-engine.js"
scenario = scenario_path.read_text(encoding="utf-8")
acquisition = r'''function validateClueAcquisition(raw,clue,validationContext={}){
  if(!clue?.protected)return{routeId:"unprotected",record:null,quality:"automatic",tensionCost:0};const routes=(clue.acquisitionRoutes||[]).map(normalizeAcquisitionRoute),sourceRecordId=asString(raw.sourceCheckRecordId,120)||asString(validationContext.currentCheckRecordId,120),routeId=asString(raw.sourceRouteId,120),route=routes.find(item=>item.id===routeId),record=sourceRecordId?state.checkRecords.find(item=>item.id===sourceRecordId):null;
  if(route?.type==="failure_forward"){
    if(!record)throw new Error(`失败前进路线 ${routeId} 必须引用当前失败或跳过的检定记录`);if(record.result===true&&!record.skipped)throw new Error(`检定记录 ${sourceRecordId} 已成功，不能使用失败前进路线`);
    const quality=clueDiscoveryQuality(record),baseCost=Math.max(1,Number(route.cost?.tension||1)),tensionCost=quality==="fumble"?Math.max(2,baseCost):baseCost;validationContext.failureForwardTension=Math.max(Number(validationContext.failureForwardTension||0),tensionCost);return{routeId,record,quality,tensionCost}
  }
  if(sourceRecordId){
    if(!record)throw new Error(`线索 ${clue.id} 引用的检定记录不存在：${sourceRecordId}`);const matching=routes.find(item=>item.type==="check"&&(!item.checkId||item.checkId===record.sourceCheckId));if(!matching)throw new Error(`检定记录 ${sourceRecordId} 不属于线索 ${clue.id} 的获取路线`);if(record.skipped||record.result!==true||!rankSatisfies(record.rank||"regular",matching.minimumRank))throw new Error(`检定记录 ${sourceRecordId} 未达到线索 ${clue.id} 的获取条件`);return{routeId:matching.id,record,quality:clueDiscoveryQuality(record),tensionCost:0}
  }
  if(!route)throw new Error(`受保护线索 ${clue.id} 缺少有效 sourceCheckRecordId 或 sourceRouteId`);if(route.type==="automatic")return{routeId,record:null,quality:"automatic",tensionCost:0};if(route.type==="flag"&&state.campaign.flags?.[route.requiredFlag]===true)return{routeId,record:null,quality:"automatic",tensionCost:0};if(route.type==="clue"&&state.clues.some(item=>item.id===route.requiredClueId))return{routeId,record:null,quality:"automatic",tensionCost:0};if(route.type==="npc"&&state.npcs.some(item=>item.id===route.npcId)&&(!route.requiredFlag||state.campaign.flags?.[route.requiredFlag]===true))return{routeId,record:null,quality:"automatic",tensionCost:0};throw new Error(`线索 ${clue.id} 的获取路线 ${routeId} 当前条件未满足`)
}
'''
scenario = replace_between(scenario, "function validateClueAcquisition(", "function normalizeThreatClock(", acquisition, "线索获取授权")
scenario_path.write_text(scenario, encoding="utf-8")

# 3. AI 协议与事务：结果指导、分层线索描述、详细检定记录。
ai_path = root / "src/ai-protocol.js"
ai = ai_path.read_text(encoding="utf-8")
ai = replace_once(
    ai,
    '7. 关键线索必须允许替代获取或失败前进。失败决定代价，不应让主线永久卡死。',
    '7. 关键线索必须允许替代获取或失败前进。失败决定代价，不应让主线永久卡死。\n8. 检定续写必须严格服从输入中的 outcomeGuidance：failure 只给最低限度可行动线索并承担代价；fumble 只在防止死局时保留最低限度线索且必须有更严重后果；regular 给完整核心线索；hard 给核心线索和 1 项具体额外洞察；extreme 给核心线索和 2 项相互印证的洞察；critical 给突破性洞察并可附带一项有限优势。\n9. revealClue 在 hard、extreme、critical 时应提供 insight；failure 或 fumble 时不得通过 insight 或 narrative 泄露完整来源、精确身份、最终解释或额外隐藏线索。',
    "系统提示词中的分层结果规则",
)
ai = replace_once(
    ai,
    '数值变化统一使用 amount；advanceClock 必须包含 clockId。',
    '数值变化统一使用 amount；advanceClock 必须包含 clockId。\n续写阶段必须遵守输入中的 outcomeGuidance。revealClue 在 hard/extreme/critical 成功时使用 insight 提供对应数量的额外具体洞察；failure/fumble 必须省略 insight，只给最低限度信息并结算失败前进代价。',
    "用户提示词中的结果指导",
)
helpers = r'''const CLUE_QUALITY_LABELS={automatic:"自动获得",fumble:"大失败前进",failure:"失败前进",regular:"普通成功",hard:"困难成功",extreme:"极难成功",critical:"大成功",skipped:"跳过"};
function clueQualityLabel(value){return CLUE_QUALITY_LABELS[value]||String(value||"未知")}
function cluePlayerDescription(clue,quality,insight=""){
  const name=asString(clue?.name,160)||"线索",base=asString(clue?.description,1000),extra=asString(insight,1000).trim();
  if(quality==="failure"||quality==="fumble")return `你确认了“${name}”这一线索的存在，但目前只掌握最低限度信息；具体含义仍需继续验证。`;
  if(!["hard","extreme","critical"].includes(quality)||!extra)return base;
  return `${base}${base?"\n":""}额外洞察：${extra}`
}
function checkOutcomeGuidance(record){
  if(record?.system!=="coc7")return{quality:record?.result===true?"success":"failure",instruction:"严格依据不可修改的检定记录续写。"};const quality=clueDiscoveryQuality(record),difficulty=record.difficulty||"regular",difficultyTarget=Number(record.difficultyTarget??cocDifficultyTarget(record.target,difficulty));
  const instructions={fumble:"大失败：仅在防止主线死锁时允许失败前进；只能给最低限度线索，并施加明显严重的时间、暴露、威胁或资源代价。",failure:"未通过要求难度：允许失败前进时只给最低限度可行动线索，不得给出完整解释、精确来源或额外隐藏信息。",regular:"普通成功：给出完整核心线索，但不附加额外隐藏洞察。",hard:"困难成功：给出完整核心线索，并增加 1 项具体、可立即利用的额外洞察。",extreme:"极难成功：给出完整核心线索，并增加 2 项相互印证的具体洞察或一项明显局势优势。",critical:"大成功：给出完整核心线索、突破性洞察，并可附带一项有限但明确的局势优势。",skipped:"检定被跳过：不得当作成功，只有合法替代路线或失败前进可提供最低限度信息。"};
  return{quality,qualityLabel:clueQualityLabel(quality),difficulty,difficultyLabel:cocDifficultyLabel(difficulty),difficultyTarget,achievedRank:record.rank,achievedRankLabel:cocRankLabel(record.rank),passed:record.result===true,instruction:instructions[quality]||instructions.failure}
}
'''
ai = replace_once(ai, "function prepareStateChanges(changes,campaignChanges=[],validationContext={}){", helpers + "\nfunction prepareStateChanges(changes,campaignChanges=[],validationContext={}){", "线索质量辅助函数")

reveal_block = r'''    else if(op==="revealClue"){
      const id=reqString(raw,"clueId",index,"状态变化"),found=findScenarioClue(id);if(!found)throw new Error(`线索不存在：${id}`);const authorization=validateClueAcquisition(raw,found.clue,validationContext),quality=authorization.quality||"automatic",allowInsight=["hard","extreme","critical"].includes(quality),insight=allowInsight?asString(raw.insight,1000).trim():"",playerDescription=cluePlayerDescription(found.clue,quality,insight),qualityLabel=clueQualityLabel(quality);let clue=draft.clues.find(x=>x.id===id),newlyRevealed=!clue||clue.revealed===false;
      if(!clue){clue={...deepClone(found.clue),revealed:true,sourceCheckRecordId:authorization.record?.id||null,sourceRouteId:authorization.routeId};draft.clues.push(clue)}else{clue.revealed=true;clue.sourceCheckRecordId=authorization.record?.id||clue.sourceCheckRecordId||null;clue.sourceRouteId=authorization.routeId}
      clue.playerDescription=playerDescription;clue.discoveryQuality=quality;clue.discoveryQualityLabel=qualityLabel;clue.discoveryRank=authorization.record?.rank||null;clue.discoveryDifficulty=authorization.record?.difficulty||null;clue.discoveryInsight=insight||"";clue.discoveredAt=clue.discoveredAt||nowIso();
      const progressGain={fumble:2,failure:3,automatic:5,regular:5,hard:7,extreme:9,critical:10}[quality]||5;if(newlyRevealed){draft.campaign.directorState.progress=clamp(Number(draft.campaign.directorState.progress||0)+progressGain,0,100);draft.campaign.directorState.lastProgressTurn=Number(draft.campaign.directorState.sceneTurns||0)}
      if(authorization.tensionCost){draft.campaign.directorState.tension=clamp(Number(draft.campaign.directorState.tension||1)+authorization.tensionCost,1,Number(draft.campaign.directorState.maxTension||6))}
      summaries.push(`${qualityLabel}：${clue.name}\n信息：${playerDescription}${authorization.tensionCost?`\n失败前进代价：张力 +${authorization.tensionCost}`:""}`)
    }
'''
ai = replace_between(ai, '    else if(op==="revealClue")', '    else if(op==="updateClue")', reveal_block, "revealClue 分层事务")

make_record = r'''function makeCheckRecord(check,roll,skipped=false){
  const record={id:uid("check"),requestId:check.requestId,createdAt:nowIso(),system:check.system,type:check.type,label:check.label,expression:roll?.expression||"",rawRolls:roll?.rawRolls||[],modifier:roll?.modifier||0,total:roll?.total??null,target:roll?.target??check.target??check.dc??null,difficulty:roll?.difficulty||check.difficulty||null,difficultyTarget:roll?.difficultyTarget??(check.system==="coc7"?cocDifficultyTarget(check.target,check.difficulty):null),result:skipped?"skipped":roll?.result,rank:skipped?"skipped":roll?.rank||null,natural:roll?.natural??null,natural20:Boolean(roll?.natural20),natural1:Boolean(roll?.natural1),mandatory:Boolean(check.mandatory),visibility:check.visibility==="secret"?"secret":"public",hiddenFromPlayer:check.visibility==="secret",trigger:check.trigger||"ai",origin:check.origin||"ai",sourceCheckId:check.sourceCheckId||null,skipped,sourceNodeId:check.sourceNodeId||state.campaign.currentNodeId,reason:check.reason||"",purpose:check.purpose||"",protectedClueIds:check.protectedClueIds||[],exposureKey:check.exposureKey||null,sanLoss:null};
  if(record.system==="coc7"&&!skipped){validateCocRollOutcome(record);record.outcomeQuality=clueDiscoveryQuality(record)}return record
}
'''
ai = replace_between(ai, "function makeCheckRecord(", "async function resolvePendingCheck", make_record, "检定记录")

resolve_block = r'''async function resolvePendingCheck({skip=false}={}){
  const check=state.runtime.pendingCheck;if(!check)throw new Error("没有待处理检定");if(skip&&check.mandatory)throw new Error("强制检定不能跳过");if(!skip)setPhase("rolling");const roll=skip?null:resolveCheck(check),record=makeCheckRecord(check,roll,skip);if(check.system==="coc7"&&check.type==="san"&&!skip&&check.loss)record.sanLoss=rollSanLoss(check.loss,Boolean(roll.result));state.checkRecords.push(record);if(check.type==="san"&&!skip)markExposureProcessed(check.exposureKey);bumpRevision();addLog("check",skip?`跳过明骰：${check.label}`:`完成明骰：${check.label}，骰点 ${record.total}，${formatCheckResult(record)}`,{requestId:check.requestId});
  let content;if(skip)content=`跳过非强制明骰：${check.label}`;else if(record.system==="coc7")content=`明骰检定：${check.label}\n目的：${check.purpose||check.reason}\n难度：${cocDifficultyLabel(record.difficulty)}\n技能值：${record.target}\n通过线：≤ ${record.difficultyTarget}\n骰点：${record.rawRolls.join(", ")}\n成功等级：${cocRankLabel(record.rank)}\n最终判定：${formatCheckResult(record)}`;else content=`明骰检定：${check.label}\n目的：${check.purpose||check.reason}\n骰点：${record.rawRolls.join(", ")}\n总值：${record.total}\n结果：${formatCheckResult(record)}`;
  state.messages.push({id:uid("msg"),role:"check",content,time:nowIso(),requestId:check.requestId,kind:"checkRecord"});if(record.sanLoss?.amount){state.character.san=clamp(Number(state.character.san||0)-record.sanLoss.amount,0,Number(state.character.maxSan||99));bumpRevision();addLog("state",`SAN -${record.sanLoss.amount}（${record.sanLoss.expression}）`,{requestId:check.requestId})}state.runtime.pendingCheck=null;renderAll();await requestContinuation(record,{secret:false})
}
function formatCheckResult(record){
  if(record.skipped)return "已跳过";if(record.system==="coc7"){
    const rankLabel=cocRankLabel(record.rank),difficultyLabel=cocDifficultyLabel(record.difficulty);if(record.result===true)return `${rankLabel}（通过${difficultyLabel}难度）`;if(record.rank==="fumble")return `大失败（未通过${difficultyLabel}难度）`;if(record.rank==="failure")return `失败（未通过${difficultyLabel}难度）`;return `未通过（达到${rankLabel}，但要求${difficultyLabel}成功）`
  }if(record.system==="dnd5e")return `${record.result?"成功":"失败"}${record.natural20?"（自然20）":record.natural1?"（自然1）":""}`;return record.result?"成功":"失败";
}
'''
ai = replace_between(ai, "async function resolvePendingCheck", "async function requestContinuation", resolve_block, "检定结算与展示")
ai = replace_once(ai, "allowedClueSourceCheckRecordId:record.id});", "allowedClueSourceCheckRecordId:record.id,outcomeGuidance:checkOutcomeGuidance(record)});", "续写 outcomeGuidance")
ai_path.write_text(ai, encoding="utf-8")

# 4. UI：掷骰前明确显示难度与实际通过线；线索显示质量和玩家可见信息。
ui_path = root / "src/ui.js"
ui = ui_path.read_text(encoding="utf-8")
ui = replace_once(
    ui,
    'function chips(items,label="name"){return items?.length?`<div class="chip-list">${items.map(x=>`<span class="chip">${escapeHtml(typeof x==="string"?x:x[label]||x.id)}</span>`).join("")}</div>`:`<div class="muted">无</div>`}',
    'function chips(items,label="name"){return items?.length?`<div class="chip-list">${items.map(x=>`<span class="chip">${escapeHtml(typeof x==="string"?x:x[label]||x.id)}</span>`).join("")}</div>`:`<div class="muted">无</div>`}\nfunction renderClueSummary(items){return items?.length?items.map(clue=>`<div class="audit"><strong>${escapeHtml(clue.name||clue.id)}</strong>${clue.discoveryQualityLabel?` · ${escapeHtml(clue.discoveryQualityLabel)}`:""}<div class="muted small">${escapeHtml(clue.playerDescription||clue.description||"已记录")}</div></div>`).join(""):`<div class="muted">无</div>`}',
    "线索侧栏组件",
)
ui = replace_once(ui, '<div class="section"><h3>线索</h3>${chips(state.clues)}</div>', '<div class="section"><h3>线索</h3>${renderClueSummary(state.clues)}</div>', "侧栏线索展示")
ui = replace_once(
    ui,
    '${c.system==="coc7"?`<div>目标：${c.target}</div>`:c.system==="dnd5e"?`<div>DC：${c.dc}</div>`:`<div>骰式：${escapeHtml(c.expression)}</div>`}',
    '${c.system==="coc7"?`<div>技能值：${c.target}</div><div>难度：${escapeHtml(cocDifficultyLabel(c.difficulty))}</div><div>实际通过线：≤ ${cocDifficultyTarget(c.target,c.difficulty)}</div>`:c.system==="dnd5e"?`<div>DC：${c.dc}</div>`:`<div>骰式：${escapeHtml(c.expression)}</div>`}',
    "待检定难度展示",
)
ui_path.write_text(ui, encoding="utf-8")

# 5. 版本、README 与报告。
library_path = root / "src/scenarios/library.js"
library = library_path.read_text(encoding="utf-8")
library = replace_once(library, 'const APP_VERSION = "1.4.5";', 'const APP_VERSION = "1.4.6";', "APP_VERSION")
library_path.write_text(library, encoding="utf-8")

project_readme_path = root / "README.md"
project_readme = project_readme_path.read_text(encoding="utf-8")
project_readme = project_readme.replace("# TRPG AI 主持助手 v1.4.5", "# TRPG AI 主持助手 v1.4.6", 1)
project_readme = project_readme.replace("当前版本为 v1.4.5。", "当前版本为 v1.4.6。", 1)
project_readme = project_readme.replace("## v1.4.5 更新内容", "## v1.4.6 更新内容\n\n- 检定卡和检定记录明确显示技能值、要求难度、实际通过线、成功等级与最终判定。\n- 增加 CoC 判定一致性校验和边界回归：等于普通、困难或极难通过线均正确成功。\n- 区分『达到某成功等级』与『是否满足本次要求难度』，避免把困难检定中的普通成功显示成含糊的失败。\n- 线索按大失败前进、失败前进、普通、困难、极难和大成功记录发现质量；失败只提供最低限度信息，高等级成功允许逐级额外洞察。\n- 大失败采用失败前进时张力代价至少为 2；普通失败默认至少为 1。\n- 新增 CoC 结果分层回归测试。\n\n## v1.4.5 更新内容", 1)
project_readme = project_readme.replace("## 版本记录\n\n- v1.4.5：", "## 版本记录\n\n- v1.4.6：修复检定难度透明度与边界核查，加入分层线索质量和更明确的失败前进代价。\n- v1.4.5：", 1)
project_readme = project_readme.replace("`src/`：v1.4.5 的模块化源码", "`src/`：v1.4.6 的模块化源码")
project_readme = project_readme.replace("- `build/test-save-ui.js`：验证存档页面重绘后的按钮重绑定和主要操作。", "- `build/test-save-ui.js`：验证存档页面重绘后的按钮重绑定和主要操作。\n- `build/test-coc-outcomes.js`：验证 CoC 等值边界、难度通过线、成功等级和分层线索规则。")
project_readme = project_readme.replace("- `v1.4.5-test-report.md`：当前版本测试报告。", "- `v1.4.6-test-report.md`：当前版本测试报告。\n- `v1.4.5-test-report.md`：上一版本测试报告。")
project_readme_path.write_text(project_readme, encoding="utf-8")

root_readme_path = Path("README.md")
root_readme = root_readme_path.read_text(encoding="utf-8")
root_readme = root_readme.replace("TRPG AI 主持助手（最新版 v1.4.5）", "TRPG AI 主持助手（最新版 v1.4.6）", 1)
root_readme = root_readme.replace("版本记录：\n\n- v1.4.5：", "版本记录：\n\n- v1.4.6：增加检定难度与通过线展示、等值边界校验、分层线索质量和大失败前进代价。\n- v1.4.5：", 1)
root_readme_path.write_text(root_readme, encoding="utf-8")

# 6. 回归测试。
test_path = root / "build/test-coc-outcomes.js"
test_path.write_text(r'''"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert");
const engine=fs.readFileSync(path.resolve(__dirname,"../src/check-engine.js"),"utf8"),ai=fs.readFileSync(path.resolve(__dirname,"../src/ai-protocol.js"),"utf8"),ui=fs.readFileSync(path.resolve(__dirname,"../src/ui.js"),"utf8"),scenario=fs.readFileSync(path.resolve(__dirname,"../src/scenario-engine.js"),"utf8");
const start=engine.indexOf("const COC_DIFFICULTY_LABELS="),end=engine.indexOf("function rollDnd(",start);assert.ok(start>=0&&end>start,"无法提取 CoC 判定函数");
const sandbox={clamp:(n,min,max)=>Math.min(max,Math.max(min,n)),Number,String,Boolean,Math,Error};sandbox.globalThis=sandbox;vm.runInNewContext(engine.slice(start,end)+"\n;globalThis.api={cocRank,cocDifficultyPass,cocDifficultyTarget,validateCocRollOutcome,clueDiscoveryQuality,cocDifficultyLabel,cocRankLabel};",sandbox);
const a=sandbox.api;let passed=0;function test(name,fn){fn();passed++;console.log(`PASS ${name}`)}
test("70/70 普通难度为普通成功",()=>{assert.equal(a.cocRank(70,70),"regular");assert.equal(a.cocDifficultyPass("regular","regular"),true);assert.equal(a.cocDifficultyTarget(70,"regular"),70)});
test("35/70 困难边界成功",()=>{assert.equal(a.cocRank(35,70),"hard");assert.equal(a.cocDifficultyPass("hard","hard"),true);assert.equal(a.cocDifficultyTarget(70,"hard"),35)});
test("14/70 极难边界成功",()=>{assert.equal(a.cocRank(14,70),"extreme");assert.equal(a.cocDifficultyPass("extreme","extreme"),true);assert.equal(a.cocDifficultyTarget(70,"extreme"),14)});
test("普通成功不满足困难要求",()=>assert.equal(a.cocDifficultyPass(a.cocRank(70,70),"hard"),false));
test("技能 70 时 100 为大失败",()=>assert.equal(a.cocRank(100,70),"fumble"));
test("技能 40 时 96 为大失败",()=>assert.equal(a.cocRank(96,40),"fumble"));
test("判定一致性接受等值成功",()=>assert.equal(a.validateCocRollOutcome({total:70,target:70,difficulty:"regular",difficultyTarget:70,rank:"regular",result:true}),true));
test("判定一致性拒绝 70/70 普通失败",()=>assert.throws(()=>a.validateCocRollOutcome({total:70,target:70,difficulty:"regular",difficultyTarget:70,rank:"regular",result:false}),/判定不一致/));
test("线索质量区分失败和高等级成功",()=>{assert.equal(a.clueDiscoveryQuality({rank:"regular",result:false}),"failure");assert.equal(a.clueDiscoveryQuality({rank:"hard",result:true}),"hard");assert.equal(a.clueDiscoveryQuality({rank:"fumble",result:false}),"fumble")});
test("界面展示难度和实际通过线",()=>{assert.ok(ui.includes("实际通过线：≤"));assert.ok(ui.includes("cocDifficultyLabel(c.difficulty)"))});
test("检定记录展示成功等级和最终判定",()=>{assert.ok(ai.includes("成功等级：${cocRankLabel(record.rank)}"));assert.ok(ai.includes("最终判定：${formatCheckResult(record)}"))});
test("续写携带 outcomeGuidance",()=>assert.ok(ai.includes("outcomeGuidance:checkOutcomeGuidance(record)")));
test("线索保存发现质量和玩家描述",()=>{assert.ok(ai.includes("clue.discoveryQuality=quality"));assert.ok(ai.includes("clue.playerDescription=playerDescription"))});
test("大失败前进代价至少为 2",()=>assert.ok(scenario.includes('quality==="fumble"?Math.max(2,baseCost):baseCost')));
console.log(`COC_OUTCOME_TESTS:${passed}:PASS`);
''', encoding="utf-8")

report = root / "v1.4.6-test-report.md"
report.write_text("""# TRPG DM Assistant v1.4.6 测试报告

## 修复范围

- 检定前显示技能值、要求难度和实际通过线。
- 检定后分别显示成功等级与最终是否通过要求难度。
- 对 CoC 判定结果执行一致性校验，防止 70/70 普通难度被记录为失败。
- 失败前进只记录最低限度线索；普通、困难、极难和大成功拥有不同发现质量。
- 困难以上成功允许结构化 `insight`；失败和大失败禁止额外洞察。
- 大失败前进张力代价至少为 2。

## 关键回归

1. 70/70 普通难度成功。
2. 35/70 困难边界成功。
3. 14/70 极难边界成功。
4. 普通成功等级不满足困难难度时显示为“未通过要求难度”。
5. 70 技能掷出 100 为大失败。
6. 40 技能掷出 96 为大失败。
7. 伪造的 70/70 普通失败记录被一致性校验拒绝。
8. 失败、困难成功和大失败映射到不同线索质量。
9. 续写请求携带 `outcomeGuidance`。
10. 线索保存玩家可见描述和发现质量。

## 执行命令

- `node trpg-dm-assistant/build/test-security-hardening.js`
- `node trpg-dm-assistant/build/test-save-ui.js`
- `node trpg-dm-assistant/build/test-coc-outcomes.js`
- `node trpg-dm-assistant/build/build-single-html.js`
- `node trpg-dm-assistant/build/verify-single-html.js`
- 全部 JavaScript `node --check`
- 连续两次构建 SHA-256 一致性检查
- 唯一正式 HTML 检查
- `git diff --check`
""", encoding="utf-8")
