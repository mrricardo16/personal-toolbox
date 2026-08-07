"use strict";
const fs=require("fs");
const path=require("path");
const file=path.resolve("trpg-dm-assistant/src/ai-protocol.js");
let text=fs.readFileSync(file,"utf8");

const marker=`\n/* =========================\n   状态变化事务`;
const helper=`\nasync function requestStructuredAiJson(messages,meta,chatOptions={}){\n  let raw=\"\";\n  for(let attempt=1;attempt<=2;attempt++){\n    raw=await callChatCompletion(messages,chatOptions);\n    try{\n      const parsed=await parseAndRepairAiResponse(raw,meta);\n      return{raw,parsed,autoRetried:attempt>1}\n    }catch(error){\n      const retryable=error?.code===\"AI_RESPONSE_JSON_PARSE_FAILED\"&&!String(raw||\"\").trim();\n      if(!retryable||attempt>=2)throw withRawResponse(error,raw,meta.stage);\n      if(state.runtime.activeRequestId!==meta.requestId)throw protocolError(\"STALE_RESPONSE\",\"空响应返回后请求已失效，不再自动重试\");\n      addLog(\"protocol_retry\",\"AI 返回空内容，未应用任何结果；自动重试同一结构化请求一次\",{requestId:meta.requestId});\n    }\n  }\n  throw protocolError(\"AI_RESPONSE_JSON_PARSE_FAILED\",\"AI 响应为空且自动重试失败\")\n}\n`;
if(!text.includes(marker))throw new Error("structured retry insert marker not found");
text=text.replace(marker,helper+marker);

const initialOld=`raw=await callChatCompletion([{role:\"system\",content:buildSystemPrompt()},{role:\"user\",content:buildUserPrompt(payload)}],{jsonMode:true,temperature:state.config.temperature});if(state.runtime.activeRequestId!==requestId)throw protocolError(\"STALE_RESPONSE\",\"旧 requestId 响应不能覆盖当前请求\");let parsed=await parseAndRepairAiResponse(raw,{requestId,baseRevision,stage});`;
const initialNew=`{const structured=await requestStructuredAiJson([{role:\"system\",content:buildSystemPrompt()},{role:\"user\",content:buildUserPrompt(payload)}],{requestId,baseRevision,stage},{jsonMode:true,temperature:state.config.temperature});raw=structured.raw;var parsed=structured.parsed}if(state.runtime.activeRequestId!==requestId)throw protocolError(\"STALE_RESPONSE\",\"旧 requestId 响应不能覆盖当前请求\");`;
if(!text.includes(initialOld))throw new Error("initial structured request patch target not found");
text=text.replace(initialOld,initialNew);

const continuationOld=`raw=await callChatCompletion([{role:\"system\",content:buildSystemPrompt()},{role:\"user\",content:buildUserPrompt(payload)}],{jsonMode:true,temperature:state.config.temperature});if(state.runtime.activeRequestId!==requestId)throw protocolError(\"STALE_RESPONSE\",\"旧 requestId 响应不能覆盖当前请求\");let parsed=await parseAndRepairAiResponse(raw,{requestId,baseRevision,stage});`;
const continuationNew=`{const structured=await requestStructuredAiJson([{role:\"system\",content:buildSystemPrompt()},{role:\"user\",content:buildUserPrompt(payload)}],{requestId,baseRevision,stage},{jsonMode:true,temperature:state.config.temperature});raw=structured.raw;var parsed=structured.parsed}if(state.runtime.activeRequestId!==requestId)throw protocolError(\"STALE_RESPONSE\",\"旧 requestId 响应不能覆盖当前请求\");`;
if(!text.includes(continuationOld))throw new Error("continuation structured request patch target not found");
text=text.replace(continuationOld,continuationNew);

const repairOld=`  const raw=await callChatCompletion([{role:\"system\",content:\"你只校正地点协议和叙事连续性，不能改变任何业务结果。\"},{role:\"user\",content:prompt}],{jsonMode:true,temperature:0.1});\n  const repaired=await parseAndRepairAiResponse(raw,{requestId,baseRevision,stage});assertLocationRepairImmutable(parsed,repaired);`;
const repairNew=`  const structured=await requestStructuredAiJson([{role:\"system\",content:\"你只校正地点协议和叙事连续性，不能改变任何业务结果。\"},{role:\"user\",content:prompt}],{requestId,baseRevision,stage},{jsonMode:true,temperature:0.1});\n  const repaired=structured.parsed;assertLocationRepairImmutable(parsed,repaired);`;
if(!text.includes(repairOld))throw new Error("location repair structured request patch target not found");
text=text.replace(repairOld,repairNew);

fs.writeFileSync(file,text,"utf8");
console.log("V154_EMPTY_RESPONSE_RETRY_PATCH_APPLIED");
