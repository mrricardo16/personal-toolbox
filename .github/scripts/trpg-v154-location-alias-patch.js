"use strict";
const fs=require("fs");
const path=require("path");
const file=path.resolve("trpg-dm-assistant/src/ai-protocol.js");
let text=fs.readFileSync(file,"utf8");

const old=`  if(isPlainObject(obj.locationEffect)&&obj.locationEffect.type!==undefined)obj.locationEffect.type=normalizeEnum(obj.locationEffect.type);\n  const amountOps=`;
const replacement=`  if(isPlainObject(obj.locationEffect)&&obj.locationEffect.type!==undefined)obj.locationEffect.type=normalizeEnum(obj.locationEffect.type);\n  if(isPlainObject(obj.nodeProposal)){\n    if(typeof obj.nodeProposal.targetNodeId==="string")obj.nodeProposal.targetNodeId=obj.nodeProposal.targetNodeId.trim();\n    else if(typeof obj.nodeProposal.id==="string")obj.nodeProposal.targetNodeId=obj.nodeProposal.id.trim();\n    if(obj.nodeProposal.title===undefined&&typeof obj.nodeProposal.name==="string")obj.nodeProposal.title=obj.nodeProposal.name.trim()\n  }\n  const amountOps=`;
if(!text.includes(old))throw new Error("nodeProposal alias patch target not found");
text=text.replace(old,replacement);

const promptOld=`只有实际完成地点切换时才使用 transition_proposal + nodeProposal。stay、blocked、searched、returned、uncertain 都表示页面确认节点不变`;
const promptNew=`只有实际完成地点切换时才使用 transition_proposal + nodeProposal；nodeProposal 的目标字段必须写 targetNodeId（页面兼容旧式 id 别名，但不要主动使用）。stay、blocked、searched、returned、uncertain 都表示页面确认节点不变`;
if(!text.includes(promptOld))throw new Error("location prompt patch target not found");
text=text.replace(promptOld,promptNew);

const repairOld=`4. 只有确实完成移动且能唯一对应内部合法出口时，才使用 transition_proposal，并原样复制对应 targetNodeId。\\`;
const repairNew=`4. 只有确实完成移动且能唯一对应内部合法出口时，才使用 transition_proposal；locationEffect.targetNodeId 与 nodeProposal.targetNodeId 都必须原样复制对应后台 targetNodeId，不要把字段写成 id。\\`;
if(!text.includes(repairOld))throw new Error("location repair prompt patch target not found");
text=text.replace(repairOld,repairNew);

fs.writeFileSync(file,text,"utf8");
console.log("V154_LOCATION_ALIAS_PATCH_APPLIED");
