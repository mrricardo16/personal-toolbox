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

# 1. 强化本地确定性 JSON 修复。禁止 eval，不让模型二次改写业务响应。
ai_path = root / "src/ai-protocol.js"
ai = ai_path.read_text(encoding="utf-8")
repair_block = r'''function stripAiJsonFences(raw){
  let text=String(raw??"").replace(/^\uFEFF/,"").trim();
  text=text.replace(/^\s*```(?:json|javascript|js)?\s*/i,"").replace(/\s*```\s*$/i,"").trim();
  const wrapped=safeJsonParse(text);if(wrapped.ok&&typeof wrapped.value==="string")text=wrapped.value.trim();return text
}
function extractAiJsonCandidate(raw){
  const text=stripAiJsonFences(raw);if(!text)return "";
  const anchor=text.search(/["'“”]?protocolVersion["'“”]?\s*[:：]/i),fallback=text.indexOf("{"),start=anchor>=0?text.lastIndexOf("{",anchor):fallback;if(start<0)return text;
  let quote=null,escape=false,stack=[];for(let i=start;i<text.length;i++){
    const char=text[i];if(quote){if(escape){escape=false;continue}if(char==="\\"){escape=true;continue}if((quote==='"'&&char==='"')||(quote==="'"&&char==="'")||(quote==="“"&&char==="”"))quote=null;continue}
    if(char==='"'||char==="'"||char==="“"){quote=char;continue}if(char==="{"||char==="[")stack.push(char);else if(char==="}"||char==="]"){const expected=char==="}"?"{":"[";if(stack.at(-1)===expected)stack.pop();if(!stack.length)return text.slice(start,i+1)}
  }
  return text.slice(start)
}
function normalizeJsonLikeSyntax(candidate){
  const source=String(candidate??"").replace(/^\uFEFF/,"").trim();let out="",quote=null,escape=false,stack=[];
  const nextNonSpace=index=>{for(let i=index;i<source.length;i++)if(!/\s/.test(source[i]))return source[i];return ""};
  for(let i=0;i<source.length;i++){
    const char=source[i],next=source[i+1]||"";
    if(quote){
      if(escape){out+=char;escape=false;continue}
      if(char==="\\"){out+=char;escape=true;continue}
      const closing=(quote==='"'&&char==='"')||(quote==="'"&&char==="'")||(quote==="“"&&char==="”");
      if(closing){const lookahead=nextNonSpace(i+1);if(quote==='"'&&lookahead&&!",:}]".includes(lookahead)){out+='\\"';continue}out+='"';quote=null;continue}
      if(char==='"'&&quote!=="\""){out+='\\"';continue}
      if(char==="\n"){out+="\\n";continue}if(char==="\r")continue;if(char==="\t"){out+="\\t";continue}
      out+=char;continue
    }
    if(char==='"'||char==="'"||char==="“"){quote=char;out+='"';continue}
    if(char==="/"&&next==="/"){while(i<source.length&&source[i]!=="\n")i++;out+="\n";continue}
    if(char==="/"&&next==="*"){i+=2;while(i<source.length-1&&!(source[i]==="*"&&source[i+1]==="/"))i++;i++;continue}
    if(char==="："){out+=":";continue}if(char==="，"||char==="；"){out+=",";continue}if(char==="`"||char==="\u200b")continue
    if(char==="{"||char==="["){stack.push(char);out+=char;continue}
    if(char==="}"||char==="]"){const expected=char==="}"?"{":"[";if(stack.at(-1)===expected){stack.pop();out+=char}continue}
    out+=char
  }
  if(quote)out+='"';while(stack.length){out+=stack.pop()==="{"?"}":"]"}
  out=out.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$-]*)(\s*:)/g,'$1"$2"$3');
  out=out.replace(/:\s*(True|False|None|undefined|NaN)(?=\s*[,}\]])/g,(_,value)=>`: ${value==="True"?"true":value==="False"?"false":"null"}`);
  out=out.replace(/:\s*([A-Za-z_][A-Za-z0-9_.-]*)(?=\s*[,}\]])/g,(match,value)=>["true","false","null"].includes(value)?match:`: "${value}"`);
  out=out.replace(/(["}\]])\s+(?="[^"]+"\s*:)/g,"$1,");
  out=out.replace(/,\s*,+/g,",").replace(/,\s*([}\]])/g,"$1");return out.trim()
}
function repairJsonSyntaxLocally(raw){return normalizeJsonLikeSyntax(extractAiJsonCandidate(raw))}
function parseAiJsonObject(text){
  const parsed=safeJsonParse(text);if(!parsed.ok)return parsed;if(typeof parsed.value==="string"){const nested=safeJsonParse(parsed.value);if(nested.ok)return nested}return parsed
}
async function parseAndRepairAiResponse(raw,meta){
  if(utf8Bytes(raw)>MAX_API_RESPONSE_BYTES)throw withRawResponse(protocolError("API_RESPONSE_TOO_LARGE","AI 响应超过安全上限"),"",meta.stage);
  const candidate=extractAiJsonCandidate(raw),first=parseAiJsonObject(candidate);if(first.ok&&isPlainObject(first.value)){try{return validateAiResponse(first.value,meta)}catch(error){throw withRawResponse(error,raw,meta.stage)}}
  const repairedText=repairJsonSyntaxLocally(raw),repaired=parseAiJsonObject(repairedText);if(!repaired.ok||!isPlainObject(repaired.value))throw withRawResponse(protocolError("AI_RESPONSE_JSON_PARSE_FAILED","AI 响应 JSON 解析失败；已尝试清理代码围栏、前后说明、中文结构标点、单引号、注释、尾逗号、裸键值和缺失闭合符，仍无法安全解析"),raw,meta.stage);
  try{return validateAiResponse(repaired.value,meta)}catch(error){throw withRawResponse(error,raw,meta.stage)}
}
'''
ai = replace_between(
    ai,
    "function repairJsonSyntaxLocally(raw){",
    "/* =========================\n   状态变化事务",
    repair_block + "\n/* =========================\n   状态变化事务",
    "AI JSON 本地修复块",
)
ai_path.write_text(ai, encoding="utf-8")

# 2. 真实脏响应语料回归。使用正式 validateAiResponse，不只测正则。
test_source = r'''"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert"),{webcrypto}=require("crypto"),{TextEncoder,TextDecoder}=require("util");
const root=path.resolve(__dirname,"..");const files=["scenarios/library.js","state.js","check-engine.js","scenario-engine.js","memory.js","ai-protocol.js","saves.js"];
function storage(){const map=new Map();return{getItem:k=>map.has(String(k))?map.get(String(k)):null,setItem:(k,v)=>map.set(String(k),String(v)),removeItem:k=>map.delete(String(k)),clear:()=>map.clear(),key:i=>Array.from(map.keys())[i]??null,get length(){return map.size}}}
const localStorage=storage(),sessionStorage=storage(),sandbox={Object,Array,JSON,Map,Set,console,crypto:webcrypto,TextEncoder,TextDecoder,URL,AbortController,setTimeout,clearTimeout,structuredClone,window:{localStorage,sessionStorage},document:{querySelector(){return null},querySelectorAll(){return[]},createElement(){return{className:"",textContent:"",appendChild(){},remove(){},click(){},style:{}}},body:{appendChild(){}}},Blob,fetch:async()=>{throw new Error("fetch not expected")},confirm:()=>false};sandbox.globalThis=sandbox;
const source=files.map(file=>fs.readFileSync(path.join(root,"src",file),"utf8")).join("\n\n")+`\n;globalThis.__test={makeInitialState,protocolSelfCheckFixtures,extractAiJsonCandidate,repairJsonSyntaxLocally,parseAndRepairAiResponse};`;
vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:"trpg-json-repair-test.js"});const api=sandbox.__test;
vm.runInContext(`state=makeInitialState();state.character={system:"coc7",san:60,luck:50,attributes:{str:50,con:50,siz:50,dex:50,app:50,int:50,pow:60,edu:50},skills:[{id:"spot_hidden",name:"侦查",value:55}]};state.scenario={id:"test",mode:"structured",chapters:[]};state.runtime.phase="awaiting_player_action";`,sandbox);
let passed=0;async function test(name,fn){await fn();passed++;console.log(`PASS ${name}`)}
function fixture(id="r",revision=1){return api.protocolSelfCheckFixtures(id,revision).noCheck}
function meta(id="r",revision=1){return{requestId:id,baseRevision:revision,stage:"action_adjudication"}}
(async()=>{
await test("标准 JSON 直接通过",async()=>{const out=await api.parseAndRepairAiResponse(JSON.stringify(fixture()),meta());assert.equal(out.decision,"no_check")});
await test("Markdown 围栏和前后说明可清理",async()=>{const raw=`以下是结果：\n\`\`\`json\n${JSON.stringify(fixture("r2",2))}\n\`\`\`\n以上。`;const out=await api.parseAndRepairAiResponse(raw,meta("r2",2));assert.equal(out.requestId,"r2")});
await test("尾逗号可修复",async()=>{const raw=JSON.stringify(fixture("r3",3)).replace(/}$/,",}");const out=await api.parseAndRepairAiResponse(raw,meta("r3",3));assert.equal(out.requestId,"r3")});
await test("中文结构标点可修复",async()=>{const raw=`{"protocolVersion"："1.3"，"requestId"："r4"，"baseRevision"：4，"decision"："no_check"，"narrative"："继续调查。"，"check"：null，"stateChanges"：[]，"campaignChanges"：[]，"locationEffect"：{"type"："stay"，"targetNodeId"：null}，"nodeProposal"：null，"endingProposal"：null，"actionSuggestions"：[]}`;const out=await api.parseAndRepairAiResponse(raw,meta("r4",4));assert.equal(out.requestId,"r4")});
await test("单引号键值可修复",async()=>{const raw=`{'protocolVersion':'1.3','requestId':'r5','baseRevision':5,'decision':'no_check','narrative':'继续调查。','check':null,'stateChanges':[],'campaignChanges':[],'locationEffect':{'type':'stay','targetNodeId':null},'nodeProposal':null,'endingProposal':null,'actionSuggestions':[]}`;const out=await api.parseAndRepairAiResponse(raw,meta("r5",5));assert.equal(out.requestId,"r5")});
await test("裸键与裸枚举可修复",async()=>{const raw=`{protocolVersion:'1.3',requestId:'r6',baseRevision:6,decision:no_check,narrative:'继续调查。',check:null,stateChanges:[],campaignChanges:[],locationEffect:{type:stay,targetNodeId:null},nodeProposal:null,endingProposal:null,actionSuggestions:[]}`;const out=await api.parseAndRepairAiResponse(raw,meta("r6",6));assert.equal(out.decision,"no_check")});
await test("字符串内真实换行可转义",async()=>{const raw=`{"protocolVersion":"1.3","requestId":"r7","baseRevision":7,"decision":"no_check","narrative":"第一行\n第二行","check":null,"stateChanges":[],"campaignChanges":[],"locationEffect":{"type":"stay","targetNodeId":null},"nodeProposal":null,"endingProposal":null,"actionSuggestions":[]}`;const out=await api.parseAndRepairAiResponse(raw,meta("r7",7));assert.match(out.narrative,/第二行/)});
await test("缺失末尾闭合符可补齐",async()=>{const raw=JSON.stringify(fixture("r8",8)).slice(0,-1);const out=await api.parseAndRepairAiResponse(raw,meta("r8",8));assert.equal(out.requestId,"r8")});
await test("JavaScript 注释可清理",async()=>{const raw=JSON.stringify(fixture("r9",9)).replace('{','{// model note\n');const out=await api.parseAndRepairAiResponse(raw,meta("r9",9));assert.equal(out.requestId,"r9")});
await test("未知 operation 修复后仍严格拒绝",async()=>{const value=fixture("r10",10);value.stateChanges=[{operation:"unknownOperation"}];const raw=`\`\`\`json\n${JSON.stringify(value).replace(/}$/,",}")}\n\`\`\``;await assert.rejects(()=>api.parseAndRepairAiResponse(raw,meta("r10",10)),/非法操作/)});
await test("纯自然语言仍拒绝而不是猜测",async()=>{await assert.rejects(()=>api.parseAndRepairAiResponse("你继续观察大厅，没有返回 JSON。",meta("r11",11)),/JSON 解析失败/)});
console.log(`AI_JSON_REPAIR_TESTS:${passed}:PASS`);
})().catch(error=>{console.error(error);process.exitCode=1});
'''
(root / "build/test-ai-json-repair.js").write_text(test_source, encoding="utf-8")

# 3. 同版本更新记录。
project_readme_path = root / "README.md"
project_readme = project_readme_path.read_text(encoding="utf-8")
marker = "## v1.4.6 更新内容\n\n"
bullet = "- 强化 AI JSON 本地确定性修复：兼容代码围栏、前后说明、中文结构标点、单引号、注释、尾逗号、裸键值、字符串内换行和缺失闭合符；未知操作与纯自然语言仍严格拒绝。\n"
if bullet not in project_readme:
    project_readme = replace_once(project_readme, marker, marker + bullet, "项目 README v1.4.6 更新内容")
project_readme_path.write_text(project_readme, encoding="utf-8")

root_readme_path = Path("README.md")
root_readme = root_readme_path.read_text(encoding="utf-8")
ability = "- AI JSON 解析加入真实脏响应语料回归，常见格式漂移由本地确定性修复处理，非法业务操作仍整体拒绝。\n"
if ability not in root_readme:
    root_readme = replace_once(root_readme, "- 生产构建移除测试接口，并通过 GitHub Actions 持续校验安全测试、语法、单文件构建和构建一致性。", "- 生产构建移除测试接口，并通过 GitHub Actions 持续校验安全测试、语法、单文件构建和构建一致性。\n" + ability, "仓库首页能力列表")
old_record = "- v1.4.6：增加检定难度与通过线展示、等值边界校验、分层线索质量、大失败前进代价，以及剧情态势阶段说明。"
new_record = "- v1.4.6：增加检定难度与通过线展示、等值边界校验、分层线索质量、大失败前进代价、剧情态势阶段说明，以及 AI JSON 脏响应确定性修复。"
root_readme = replace_once(root_readme, old_record, new_record, "仓库首页 v1.4.6 版本记录")
root_readme_path.write_text(root_readme, encoding="utf-8")

report_path = root / "v1.4.6-test-report.md"
report = report_path.read_text(encoding="utf-8")
report_bullet = "- 增加 AI JSON 真实脏响应语料回归；常见语法漂移可本地修复，非法 operation 与纯自然语言仍拒绝。\n"
if report_bullet not in report:
    report = replace_once(report, "## 修复范围\n\n", "## 修复范围\n\n" + report_bullet, "测试报告修复范围")
regression = "14. 代码围栏、前后说明和尾逗号可修复。\n15. 中文结构标点、单引号、裸键值和字符串内换行可修复。\n16. JavaScript 注释和缺失末尾闭合符可修复。\n17. 未知 operation 与纯自然语言仍严格拒绝。\n"
if "14. 代码围栏" not in report:
    report = replace_once(report, "13. APP_VERSION 保持 v1.4.6。\n", "13. APP_VERSION 保持 v1.4.6。\n" + regression, "测试报告关键回归")
command = "- `node trpg-dm-assistant/build/test-ai-json-repair.js`\n"
if command not in report:
    report = replace_once(report, "- `node trpg-dm-assistant/build/test-situation-ui.js`\n", "- `node trpg-dm-assistant/build/test-situation-ui.js`\n" + command, "测试报告执行命令")
report_path.write_text(report, encoding="utf-8")
