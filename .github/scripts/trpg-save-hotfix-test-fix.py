from pathlib import Path


test_source = r'''"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert");
const ui=fs.readFileSync(path.resolve(__dirname,"../src/ui.js"),"utf8");
let passed=0;
function test(name,fn){fn();passed++;console.log(`PASS ${name}`)}
const renderStart=ui.indexOf("function renderSaves(){");
const bindStart=ui.indexOf("function bindSaveEvents(){");
assert.ok(renderStart>=0,"缺少 renderSaves");
assert.ok(bindStart>renderStart,"缺少 bindSaveEvents");
const renderBlock=ui.slice(renderStart,bindStart);
const handler=ui.slice(bindStart,bindStart+6000);
test("renderSaves 重绘后绑定事件",()=>assert.ok(renderBlock.includes("bindSaveEvents();")));
test("保存按钮有处理器",()=>assert.ok(handler.includes('const saveBtn=$("#saveNowBtn")')&&handler.includes("state.saveMeta.slotName=readSaveSlotName();saveCurrentSlot()")));
test("另存为按钮有处理器",()=>assert.ok(handler.includes('const newSlot=$("#newSlotBtn")')&&handler.includes("uniqueNewSlotName(base)")));
test("导出按钮有处理器",()=>assert.ok(handler.includes('const exportBtn=$("#exportSaveBtn")')&&handler.includes("exportCurrentSave()")));
test("导入按钮触发文件选择",()=>assert.ok(handler.includes('const importSave=$("#importSaveBtn")')&&handler.includes('$("#saveFileInput")?.click()')));
test("诊断按钮有处理器",()=>assert.ok(handler.includes('const diagnosticBtn=$("#exportDiagnosticBtn")')&&handler.includes("showDiagnosticExportModal")));
test("槽位载入按钮有处理器",()=>assert.ok(handler.includes("$$('[data-load-slot]')")&&handler.includes("loadSlot(button.dataset.loadSlot)")));
test("槽位删除按钮有处理器",()=>assert.ok(handler.includes("$$('[data-delete-slot]')")&&handler.includes("deleteSlot(button.dataset.deleteSlot)")));
test("新槽位名称自动去重",()=>{const match=ui.match(/function uniqueNewSlotName\(base\)\{[^\n]+\}/);assert.ok(match);const sandbox={asString:(value,max)=>String(value??"").slice(0,max),getSaveIndex:()=>[{slotName:"调查"},{slotName:"调查 (2)"}]};vm.runInNewContext(`${match[0]};globalThis.result=uniqueNewSlotName("调查")`,sandbox);assert.equal(sandbox.result,"调查 (3)")});
console.log(`SAVE_UI_TESTS:${passed}:PASS`);
'''
Path("trpg-dm-assistant/build/test-save-ui.js").write_text(test_source, encoding="utf-8")
