from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"无法定位：{label}")
    return text.replace(old, new, 1)


root = Path("trpg-dm-assistant")

# 1. 侧栏剧情态势说明：保持 APP_VERSION 1.4.6 不变。
ui_path = root / "src/ui.js"
ui = ui_path.read_text(encoding="utf-8")
helpers = r'''function tensionStage(current,max=6){
  const safeMax=Math.max(1,Number(max||6)),normalized=clamp(Number(current||1),1,safeMax),level=Math.max(1,Math.min(6,Math.ceil(normalized/safeMax*6)));
  return [
    {label:"局势平静",description:"威胁尚未主动介入，调查仍有余裕。"},
    {label:"异常显现",description:"环境或相关人物开始出现可疑变化。"},
    {label:"威胁正在行动",description:"对手或环境开始主动施压；张力本身不会直接修改骰点。"},
    {label:"危险逼近",description:"证据、路线或 NPC 可能受到主动干预。"},
    {label:"危机临界",description:"直接冲突、追逐或重大损失即将发生。"},
    {label:"危机爆发",description:"局势进入高潮，应尽快作出关键决断。"}
  ][level-1]
}
function investigationStage(current){
  const value=clamp(Number(current||0),0,100);
  if(value>=100)return{label:"调查充分",description:"当前调查目标已获得充分推进。"};
  if(value>=80)return{label:"证据收束",description:"主要脉络已经形成，接近作出结论。"};
  if(value>=60)return{label:"接近核心",description:"关键问题逐步明确，仍需补足证据。"};
  if(value>=30)return{label:"案情展开",description:"线索之间开始建立联系。"};
  if(value>=10)return{label:"线索成形",description:"已有若干线索，但尚不足以形成稳定判断。"};
  return{label:"调查起步",description:"目前只掌握少量有效信息。"}
}
function situationMeter(label,current,max,status){return `${meter(label,current,max)}<div class="small" style="margin:4px 0 9px"><strong>${escapeHtml(status.label)}</strong><div class="muted">${escapeHtml(status.description)}</div></div>`}
'''
if "function tensionStage(" not in ui:
    ui = replace_once(
        ui,
        'function chips(items,label="name"){',
        helpers + '\nfunction chips(items,label="name"){',
        "剧情态势辅助函数插入点",
    )
old = '${meter("张力",director.tension,director.maxTension)}${meter("调查进度",director.progress,100)}'
new = '${situationMeter("张力",director.tension,director.maxTension,tensionStage(director.tension,director.maxTension))}${situationMeter("调查进度",director.progress,100,investigationStage(director.progress))}'
ui = replace_once(ui, old, new, "剧情态势进度条渲染")
ui_path.write_text(ui, encoding="utf-8")

# 2. 独立回归测试。
test_source = r'''"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert");
const ui=fs.readFileSync(path.resolve(__dirname,"../src/ui.js"),"utf8"),library=fs.readFileSync(path.resolve(__dirname,"../src/scenarios/library.js"),"utf8");
const start=ui.indexOf("function tensionStage("),end=ui.indexOf("function situationMeter(",start);assert.ok(start>=0&&end>start,"无法提取剧情态势阶段函数");
const sandbox={clamp:(n,min,max)=>Math.min(max,Math.max(min,n)),Number,Math};sandbox.globalThis=sandbox;
vm.runInNewContext(ui.slice(start,end)+"\n;globalThis.api={tensionStage,investigationStage};",sandbox,{filename:"situation-stage-functions.js"});
const api=sandbox.api;let passed=0;function test(name,fn){fn();passed++;console.log(`PASS ${name}`)}
test("张力 1/6 显示局势平静",()=>assert.equal(api.tensionStage(1,6).label,"局势平静"));
test("张力 3/6 显示威胁正在行动",()=>assert.equal(api.tensionStage(3,6).label,"威胁正在行动"));
test("张力 3/6 说明不会直接修改骰点",()=>assert.match(api.tensionStage(3,6).description,/不会直接修改骰点/));
test("张力 6/6 显示危机爆发",()=>assert.equal(api.tensionStage(6,6).label,"危机爆发"));
test("调查进度 5 显示调查起步",()=>assert.equal(api.investigationStage(5).label,"调查起步"));
test("调查进度 50 显示案情展开",()=>assert.equal(api.investigationStage(50).label,"案情展开"));
test("调查进度 100 显示调查充分",()=>assert.equal(api.investigationStage(100).label,"调查充分"));
test("侧栏使用张力阶段说明",()=>assert.ok(ui.includes('situationMeter("张力"')));
test("侧栏使用调查进度阶段说明",()=>assert.ok(ui.includes('situationMeter("调查进度"')));
test("补丁保持 v1.4.6",()=>assert.ok(library.includes('const APP_VERSION = "1.4.6";')));
console.log(`SITUATION_UI_TESTS:${passed}:PASS`);
'''
(root / "build/test-situation-ui.js").write_text(test_source, encoding="utf-8")

# 3. 同版本更新记录。
project_readme_path = root / "README.md"
project_readme = project_readme_path.read_text(encoding="utf-8")
marker = "## v1.4.6 更新内容\n\n"
bullet = "- 剧情态势侧栏增加阶段说明：张力显示当前危险阶段及含义，调查进度显示当前调查成熟度；明确张力本身不会直接修改骰点。\n"
if bullet not in project_readme:
    project_readme = replace_once(project_readme, marker, marker + bullet, "项目 README v1.4.6 更新内容")
project_readme_path.write_text(project_readme, encoding="utf-8")

root_readme_path = Path("README.md")
root_readme = root_readme_path.read_text(encoding="utf-8")
ability = "- 剧情态势侧栏为张力和调查进度显示当前阶段说明，明确张力代表局势升级而非骰点惩罚。\n"
if ability not in root_readme:
    root_readme = replace_once(root_readme, "- 支持本地多槽位存档、导入和导出。", ability + "- 支持本地多槽位存档、导入和导出。", "仓库首页能力列表")
old_record = "- v1.4.6：增加检定难度与通过线展示、等值边界校验、分层线索质量和大失败前进代价。"
new_record = "- v1.4.6：增加检定难度与通过线展示、等值边界校验、分层线索质量、大失败前进代价，以及剧情态势阶段说明。"
root_readme = replace_once(root_readme, old_record, new_record, "仓库首页 v1.4.6 版本记录")
root_readme_path.write_text(root_readme, encoding="utf-8")

report_path = root / "v1.4.6-test-report.md"
report = report_path.read_text(encoding="utf-8")
report_bullet = "- 剧情态势侧栏增加张力和调查进度阶段说明，并明确张力不会直接修改骰点。\n"
if report_bullet not in report:
    report = replace_once(report, "## 修复范围\n\n", "## 修复范围\n\n" + report_bullet, "测试报告修复范围")
regression = "11. 张力 1/6、3/6、6/6 映射到不同局势说明。\n12. 调查进度 5、50、100 映射到不同调查阶段。\n13. APP_VERSION 保持 v1.4.6。\n"
if "11. 张力 1/6" not in report:
    report = replace_once(report, "10. 线索保存玩家可见描述和发现质量。\n", "10. 线索保存玩家可见描述和发现质量。\n" + regression, "测试报告关键回归")
command = "- `node trpg-dm-assistant/build/test-situation-ui.js`\n"
if command not in report:
    report = replace_once(report, "- `node trpg-dm-assistant/build/test-coc-outcomes.js`\n", "- `node trpg-dm-assistant/build/test-coc-outcomes.js`\n" + command, "测试报告执行命令")
report_path.write_text(report, encoding="utf-8")
