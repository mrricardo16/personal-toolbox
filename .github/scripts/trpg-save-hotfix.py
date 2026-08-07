from pathlib import Path


def replace_between(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    end = text.find(end_marker, start + len(start_marker))
    if start < 0 or end < 0:
        raise RuntimeError(f"无法定位：{label}")
    return text[:start] + replacement.rstrip() + "\n" + text[end:]


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"无法定位：{label}")
    return text.replace(old, new, 1)


ui_path = Path("trpg-dm-assistant/src/ui.js")
ui = ui_path.read_text(encoding="utf-8")
save_ui = r'''function renderSaves(){
  const view=$("#view-saves");if(!view)return;const index=getSaveIndex(),stats=appStorageStats(),sizeById=Object.fromEntries(stats.slots.map(item=>[item.slotId,item.bytes])),currentId=state.saveMeta.slotId,lastSaved=state.saveMeta.updatedAt?formatTime(state.saveMeta.updatedAt):"尚未保存";
  view.innerHTML=`<div class="hero"><h1>存档管理</h1><div class="card"><div class="row"><div class="field grow"><label>当前槽位名称</label><input id="slotNameInput" value="${escapeHtml(state.saveMeta.slotName||"未命名调查")}"></div><button id="saveNowBtn" class="btn primary" type="button">保存当前槽位</button><button id="newSlotBtn" class="btn" type="button">另存为新槽位</button><button id="exportSaveBtn" class="btn" type="button">导出当前 JSON</button><button id="importSaveBtn" class="btn" type="button">导入 JSON 为新槽位</button></div><div class="notice">保存会覆盖当前槽位；另存为会复制当前进度并创建新槽位。导入会先预览，然后创建新槽位，不覆盖当前存档。API Key 不进入存档。</div><div class="kv" style="margin-top:10px"><span>当前槽位</span><b>${escapeHtml(currentId?(state.saveMeta.slotName||"未命名调查"):"未建档")}</b><span>最后保存</span><b>${escapeHtml(lastSaved)}</b><span>未保存变更</span><b>${state.runtime.isDirty?"有":"无"}</b></div></div><div class="card" style="margin-top:14px"><h2>存储与诊断</h2><div class="kv"><span>当前存档估算</span><b>${formatBytes(stats.currentBytes)}</b><span>本工具本地占用</span><b>${formatBytes(stats.total)}</b><span>当前消息 / 审计</span><b>${state.messages.length} / ${state.logs.length}</b></div><div class="row"><button id="exportDiagnosticBtn" class="btn" type="button">导出诊断包</button><button id="clearOldLogsBtn" class="btn warn" type="button">清理旧审计日志</button></div></div><div class="card" style="margin-top:14px"><h2>本地槽位</h2><table class="table"><thead><tr><th>名称</th><th>更新时间</th><th>大小</th><th>状态</th><th>操作</th></tr></thead><tbody>${index.map(x=>{const active=x.slotId===currentId;return `<tr><td>${escapeHtml(x.slotName)}</td><td>${escapeHtml(formatTime(x.updatedAt))}</td><td>${formatBytes(sizeById[x.slotId]||0)}</td><td>${active?'<span class="chip">当前使用</span>':'<span class="muted">-</span>'}</td><td><button class="btn" data-load-slot="${escapeHtml(x.slotId)}" ${active?'disabled':''}>${active?'当前槽位':'载入'}</button> <button class="btn danger" data-delete-slot="${escapeHtml(x.slotId)}">删除</button></td></tr>`}).join("")||`<tr><td colspan="5" class="muted">暂无存档</td></tr>`}</tbody></table></div></div>`;
  bindSaveEvents();
}
function readSaveSlotName(){return asString($("#slotNameInput")?.value,80).trim()||"未命名调查"}
function uniqueNewSlotName(base){const clean=asString(base,80).trim()||"未命名调查",names=new Set(getSaveIndex().map(item=>String(item.slotName||"")));if(!names.has(clean))return clean;let index=2,candidate=`${clean} (${index})`;while(names.has(candidate)&&index<999){index++;candidate=`${clean} (${index})`}return candidate}
function bindSaveEvents(){
  const slotNameInput=$("#slotNameInput");if(slotNameInput)slotNameInput.onkeydown=event=>{if(event.key==="Enter"){event.preventDefault();$("#saveNowBtn")?.click()}};
  const saveBtn=$("#saveNowBtn");if(saveBtn)saveBtn.onclick=()=>{state.saveMeta.slotName=readSaveSlotName();saveCurrentSlot()};
  const newSlot=$("#newSlotBtn");if(newSlot)newSlot.onclick=()=>{const previousName=state.saveMeta.slotName||"未命名调查",requested=readSaveSlotName(),base=requested===previousName?`${requested} 副本`:requested;state.saveMeta.slotId=null;state.saveMeta.slotName=uniqueNewSlotName(base);state.saveMeta.createdAt=null;saveCurrentSlot();toast(`已创建新槽位：${state.saveMeta.slotName}`,"ok")};
  const exportBtn=$("#exportSaveBtn");if(exportBtn)exportBtn.onclick=()=>{state.saveMeta.slotName=readSaveSlotName();exportCurrentSave()};
  const importSave=$("#importSaveBtn");if(importSave)importSave.onclick=()=>$("#saveFileInput")?.click();
  const diagnosticBtn=$("#exportDiagnosticBtn");if(diagnosticBtn)diagnosticBtn.onclick=showDiagnosticExportModal;
  const clearLogsBtn=$("#clearOldLogsBtn");if(clearLogsBtn)clearLogsBtn.onclick=()=>{if(confirm("仅保留最近 300 条审计日志。聊天、检定和游戏状态不会删除。继续吗？"))clearOldAuditLogs()};
  $$('[data-load-slot]').forEach(button=>button.onclick=()=>{try{loadSlot(button.dataset.loadSlot)}catch(error){toast(error.message,"danger")}});
  $$('[data-delete-slot]').forEach(button=>button.onclick=()=>{if(confirm("删除后无法恢复，确认删除？"))deleteSlot(button.dataset.deleteSlot)});
}'''
ui = replace_between(ui, "function renderSaves(){", "function renderAll(){", save_ui, "存档页面")
binding_start = ui.find('  const saveBtn=$("#saveNowBtn");')
binding_end = ui.find("  $$('[data-modal-close]')", binding_start)
if binding_start < 0 or binding_end < 0:
    raise RuntimeError("无法定位：旧存档事件绑定")
ui = ui[:binding_start] + "  bindSaveEvents();\n" + ui[binding_end:]
ui_path.write_text(ui, encoding="utf-8")

library_path = Path("trpg-dm-assistant/src/scenarios/library.js")
library = library_path.read_text(encoding="utf-8")
library = replace_once(library, 'const APP_VERSION = "1.4.4";', 'const APP_VERSION = "1.4.5";', "APP_VERSION")
library_path.write_text(library, encoding="utf-8")

ci_path = Path(".github/workflows/trpg-ci.yml")
ci = ci_path.read_text(encoding="utf-8")
marker = "      - name: JavaScript syntax\n"
if "Save management interaction regression" not in ci:
    ci = replace_once(ci, marker, "      - name: Save management interaction regression\n        run: node trpg-dm-assistant/build/test-save-ui.js\n\n" + marker, "CI 插入点")
ci_path.write_text(ci, encoding="utf-8")

test_source = r'''"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert");
const ui=fs.readFileSync(path.resolve(__dirname,"../src/ui.js"),"utf8");
assert.match(ui,/function renderSaves\(\)[\s\S]*?bindSaveEvents\(\);\n\s*\}/,"renderSaves 必须在重绘后重新绑定事件");
const start=ui.indexOf("function readSaveSlotName(){"),end=ui.indexOf("function renderAll(){",start);assert.ok(start>=0&&end>start);
const elements={slotNameInput:{value:"回归槽位",onkeydown:null},saveNowBtn:{onclick:null,click(){this.onclick?.()}},newSlotBtn:{onclick:null,click(){this.onclick?.()}},exportSaveBtn:{onclick:null,click(){this.onclick?.()}},importSaveBtn:{onclick:null,click(){this.onclick?.()}},exportDiagnosticBtn:{onclick:null,click(){this.onclick?.()}},clearOldLogsBtn:{onclick:null,click(){this.onclick?.()}},saveFileInput:{clicks:0,click(){this.clicks++}}};
const loadButton={dataset:{loadSlot:"slot-load"},onclick:null},deleteButton={dataset:{deleteSlot:"slot-delete"},onclick:null};
const calls={save:0,export:0,diagnostic:0,clear:0,load:[],delete:[]};
const sandbox={console,state:{saveMeta:{slotId:"slot-current",slotName:"回归槽位",createdAt:"x"}},asString:(v,max)=>typeof v==="string"?v.slice(0,max):"",getSaveIndex:()=>[{slotId:"slot-current",slotName:"回归槽位"},{slotId:"slot-old",slotName:"回归槽位 副本"}],$:(selector)=>elements[selector.replace(/^#/,"")]||null,$$:(selector)=>selector==="[data-load-slot]"?[loadButton]:selector==="[data-delete-slot]"?[deleteButton]:[],saveCurrentSlot:()=>{calls.save++},exportCurrentSave:()=>{calls.export++},showDiagnosticExportModal:()=>{calls.diagnostic++},clearOldAuditLogs:()=>{calls.clear++},loadSlot:id=>calls.load.push(id),deleteSlot:id=>calls.delete.push(id),toast:()=>{},confirm:()=>true};sandbox.globalThis=sandbox;
vm.runInNewContext(ui.slice(start,end)+"\n;globalThis.bindSaveEvents=bindSaveEvents;",sandbox);
sandbox.bindSaveEvents();elements.saveNowBtn.click();assert.equal(calls.save,1);
elements.newSlotBtn.click();assert.equal(calls.save,2);assert.equal(sandbox.state.saveMeta.slotId,null);assert.equal(sandbox.state.saveMeta.slotName,"回归槽位 副本 (2)");
elements.exportSaveBtn.click();elements.importSaveBtn.click();elements.exportDiagnosticBtn.click();elements.clearOldLogsBtn.click();loadButton.onclick();deleteButton.onclick();
assert.equal(calls.export,1);assert.equal(elements.saveFileInput.clicks,1);assert.equal(calls.diagnostic,1);assert.equal(calls.clear,1);assert.deepEqual(calls.load,["slot-load"]);assert.deepEqual(calls.delete,["slot-delete"]);
elements.saveNowBtn={onclick:null,click(){this.onclick?.()}};sandbox.bindSaveEvents();elements.saveNowBtn.click();assert.equal(calls.save,3);
console.log("SAVE_UI_TESTS:9:PASS");
'''
Path("trpg-dm-assistant/build/test-save-ui.js").write_text(test_source, encoding="utf-8")

project = Path("trpg-dm-assistant/README.md")
text = project.read_text(encoding="utf-8")
text = text.replace("# TRPG AI 主持助手 v1.4.4", "# TRPG AI 主持助手 v1.4.5", 1).replace("当前版本为 v1.4.4。", "当前版本为 v1.4.5。", 1)
text = text.replace("## v1.4.4 更新内容", "## v1.4.5 更新内容\n\n- 修复存档页面重绘后按钮事件丢失，保存、另存为、导入、导出、诊断和槽位按钮持续可用。\n- 将存档交互抽离为专用 `bindSaveEvents()`，并由 `renderSaves()` 每次重绘后立即重新绑定。\n- 增加当前槽位、最后保存时间、未保存变更和当前槽位标识。\n- 新增存档交互回归测试并纳入 CI。\n\n## v1.4.4 更新内容", 1)
text = text.replace("## 版本记录\n\n- v1.4.4：", "## 版本记录\n\n- v1.4.5：修复存档页面重绘后按钮失效，并增加交互回归测试。\n- v1.4.4：", 1)
text = text.replace("- `src/`：v1.4.4 的模块化源码", "- `src/`：v1.4.5 的模块化源码", 1)
text = text.replace("- `build/test-security-hardening.js`：运行 API、安全、存档导入和正式协议行为测试。", "- `build/test-security-hardening.js`：运行 API、安全、存档导入和正式协议行为测试。\n- `build/test-save-ui.js`：验证存档页面重绘后的按钮重绑定和主要操作。", 1)
text = text.replace("- `v1.4.4-test-report.md`：当前版本测试报告。", "- `v1.4.5-test-report.md`：当前版本测试报告。\n- `v1.4.4-test-report.md`：上一版本测试报告。", 1)
project.write_text(text, encoding="utf-8")

root = Path("README.md")
text = root.read_text(encoding="utf-8")
text = text.replace("### TRPG AI 主持助手（最新版 v1.4.4）", "### TRPG AI 主持助手（最新版 v1.4.5）", 1)
text = text.replace("- 支持本地多槽位存档、导入和导出。", "- 修复存档页面重绘后按钮事件丢失，保存、另存为、导入、导出和槽位操作持续可用。\n- 支持本地多槽位存档、导入和导出。", 1)
text = text.replace("版本记录：\n\n- v1.4.4：", "版本记录：\n\n- v1.4.5：修复存档页面重绘后按钮失效，并新增存档交互回归测试。\n- v1.4.4：", 1)
root.write_text(text, encoding="utf-8")

report = '''# TRPG DM Assistant v1.4.5 测试报告

## 缺陷原因

存档按钮原本仅由 `bindDynamicEvents()` 绑定；`saveCurrentSlot()`、自动保存和删除槽位会调用 `renderSaves()` 重建 DOM，新按钮因此失去事件。

## 修复

- 新增 `bindSaveEvents()`。
- `renderSaves()` 每次重绘后立即重新绑定全部存档按钮。
- 保存、另存为、导入、导出、诊断、日志清理、载入和删除均纳入回归测试。
- 当前槽位禁止重复载入，并显示保存状态。

## 验证命令

- `node trpg-dm-assistant/build/test-security-hardening.js`
- `node trpg-dm-assistant/build/test-save-ui.js`
- `node trpg-dm-assistant/build/build-single-html.js`
- `node trpg-dm-assistant/build/verify-single-html.js`
- 全部 JavaScript `node --check`
- 连续两次构建 SHA-256 一致性校验
- 唯一产品 HTML 检查
- `git diff --check`
'''
Path("trpg-dm-assistant/v1.4.5-test-report.md").write_text(report, encoding="utf-8")
