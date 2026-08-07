from pathlib import Path


test_source = r'''"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert");
const ui=fs.readFileSync(path.resolve(__dirname,"../src/ui.js"),"utf8");
let passed=0;
function test(name,fn){fn();passed++;console.log(`PASS ${name}`)}
test("renderSaves 重绘后绑定事件",()=>assert.match(ui,/function renderSaves\(\)[\s\S]*?bindSaveEvents\(\);/));
test("存在专用存档绑定函数",()=>assert.match(ui,/function bindSaveEvents\(\)/));
test("保存按钮有处理器",()=>assert.match(ui,/saveNowBtn[\s\S]*?saveCurrentSlot\(\)/));
test("另存为按钮有处理器",()=>assert.match(ui,/newSlotBtn[\s\S]*?uniqueNewSlotName/));
test("导出按钮有处理器",()=>assert.match(ui,/exportSaveBtn[\s\S]*?exportCurrentSave\(\)/));
test("导入按钮触发文件选择",()=>assert.match(ui,/importSaveBtn[\s\S]*?saveFileInput/));
test("槽位载入按钮有处理器",()=>assert.match(ui,/data-load-slot[\s\S]*?loadSlot/));
test("槽位删除按钮有处理器",()=>assert.match(ui,/data-delete-slot[\s\S]*?deleteSlot/));
test("新槽位名称自动去重",()=>{const match=ui.match(/function uniqueNewSlotName\(base\)\{[^\n]+\}/);assert.ok(match);const sandbox={asString:(value,max)=>String(value??"").slice(0,max),getSaveIndex:()=>[{slotName:"调查"},{slotName:"调查 (2)"}]};vm.runInNewContext(`${match[0]};globalThis.result=uniqueNewSlotName("调查")`,sandbox);assert.equal(sandbox.result,"调查 (3)")});
console.log(`SAVE_UI_TESTS:${passed}:PASS`);
'''
Path("trpg-dm-assistant/build/test-save-ui.js").write_text(test_source, encoding="utf-8")
