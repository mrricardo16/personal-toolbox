"use strict";
const fs=require("fs");
const path=require("path");
const file=path.resolve("trpg-dm-assistant/src/ai-protocol.js");
let text=fs.readFileSync(file,"utf8");

const old=`  const amountOps=new Set([\"adjustHp\",\"adjustSan\",\"adjustResource\",\"adjustTension\",\"adjustProgress\",\"advanceClock\"]);for(const list of [obj.stateChanges,obj.campaignChanges])if(Array.isArray(list))for(const item of list){if(!isPlainObject(item))continue;if(typeof item.operation===\"string\")item.operation=item.operation.trim();if(!amountOps.has(item.operation)||item.amount!==undefined)continue;for(const alias of [\"by\",\"delta\"]){if(item[alias]!==undefined&&Number.isFinite(Number(item[alias]))){item.amount=Number(item[alias]);break}}}`;
const replacement=`  const operationIdFields={removeItem:\"itemId\",updateItemQuantity:\"itemId\",removeStatus:\"statusId\",revealClue:\"clueId\",updateClue:\"clueId\",updateNpc:\"npcId\",resolveLead:\"leadId\",resolveQuestion:\"questionId\",advanceClock:\"clockId\",resolveClock:\"clockId\"};\n  const amountOps=new Set([\"adjustHp\",\"adjustSan\",\"adjustResource\",\"adjustTension\",\"adjustProgress\",\"advanceClock\"]);for(const list of [obj.stateChanges,obj.campaignChanges])if(Array.isArray(list))for(const item of list){if(!isPlainObject(item))continue;if(typeof item.operation===\"string\")item.operation=item.operation.trim();const idField=operationIdFields[item.operation];if(idField&&item[idField]===undefined&&typeof item.id===\"string\")item[idField]=item.id.trim();if(!amountOps.has(item.operation)||item.amount!==undefined)continue;for(const alias of [\"by\",\"delta\"]){if(item[alias]!==undefined&&Number.isFinite(Number(item[alias]))){item.amount=Number(item[alias]);break}}}`;
if(!text.includes(old))throw new Error("operation id alias patch target not found");
text=text.replace(old,replacement);

const promptOld=`数值变化统一使用 amount；advanceClock 必须包含 clockId。`;
const promptNew=`数值变化统一使用 amount；实体操作请使用类型化 ID 字段：itemId、statusId、clueId、npcId、leadId、questionId、clockId。页面只为兼容性接受部分 operation 内的通用 id 别名，不要主动使用；advanceClock 必须包含 clockId。`;
if(!text.includes(promptOld))throw new Error("operation id prompt patch target not found");
text=text.replace(promptOld,promptNew);

fs.writeFileSync(file,text,"utf8");
console.log("V154_OPERATION_ID_ALIAS_PATCH_APPLIED");
