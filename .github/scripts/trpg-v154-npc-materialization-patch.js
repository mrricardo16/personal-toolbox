"use strict";
const fs=require("fs");
const path=require("path");

const stateFile=path.resolve("trpg-dm-assistant/src/state.js");
const scenarioFile=path.resolve("trpg-dm-assistant/src/scenario-engine.js");
let stateText=fs.readFileSync(stateFile,"utf8");
let scenarioText=fs.readFileSync(scenarioFile,"utf8");

const findNodeBlock=`function findNode(id){\n  if(!state.scenario)return null;for(const chapter of state.scenario.chapters||[])for(const scene of chapter.scenes||[])for(const node of scene.nodes||[])if(node.id===id)return {chapter,scene,node};return null;\n}\n`;
const helper=`function materializeNodeNpcs(node=getCurrentNode(),target=state.npcs){\n  if(!node||!Array.isArray(target))return 0;let added=0;\n  for(const raw of node.npcs||[]){\n    if(!isPlainObject(raw))continue;const id=asString(raw.id,100).trim();if(!id)continue;\n    let npc=target.find(item=>item.id===id);\n    if(npc){ensureNpcContinuity(npc);continue}\n    npc={id,name:asString(raw.name,160).trim()||id,description:asString(raw.description,1000),attitude:asString(raw.attitude,100)};\n    if(isPlainObject(raw.continuity))npc.continuity=deepClone(raw.continuity);\n    ensureNpcContinuity(npc);target.push(npc);added+=1\n  }\n  return added\n}\n`;
if(!stateText.includes(findNodeBlock))throw new Error("findNode patch target not found");
stateText=stateText.replace(findNodeBlock,findNodeBlock+helper);

const enterOld=`state.campaign.currentSceneId=found.scene.id;state.campaign.currentNodeId=found.node.id;state.campaign.currentLocation=found.node.title;state.runtime.pendingNodeProposal=null;`;
const enterNew=`state.campaign.currentSceneId=found.scene.id;state.campaign.currentNodeId=found.node.id;state.campaign.currentLocation=found.node.title;materializeNodeNpcs(found.node,state.npcs);state.runtime.pendingNodeProposal=null;`;
if(!stateText.includes(enterOld))throw new Error("enterNode patch target not found");
stateText=stateText.replace(enterOld,enterNew);

const loadOld=`state.runtime.activeRequestId=null;state.runtime.requestStartedAt=null;state.runtime.pendingCheck=state.runtime.pendingCheck||null;state.runtime.pendingNodeProposal=state.runtime.pendingNodeProposal||null;\n  if(interrupted){`;
const loadNew=`state.runtime.activeRequestId=null;state.runtime.requestStartedAt=null;state.runtime.pendingCheck=state.runtime.pendingCheck||null;state.runtime.pendingNodeProposal=state.runtime.pendingNodeProposal||null;\n  materializeNodeNpcs(getCurrentNode(),state.npcs);\n  if(interrupted){`;
if(!stateText.includes(loadOld))throw new Error("sanitizeRuntimeAfterLoad patch target not found");
stateText=stateText.replace(loadOld,loadNew);

const activateOld=`state.campaign.currentNodeId=first.id;state.campaign.currentChapterId=state.scenario.chapters[0].id;state.campaign.currentSceneId=state.scenario.chapters[0].scenes[0].id;state.campaign.currentLocation=first.title;state.campaign.currentTime=state.scenario.briefing?.openingTime||"";`;
const activateNew=`state.campaign.currentNodeId=first.id;state.campaign.currentChapterId=state.scenario.chapters[0].id;state.campaign.currentSceneId=state.scenario.chapters[0].scenes[0].id;state.campaign.currentLocation=first.title;materializeNodeNpcs(first,state.npcs);state.campaign.currentTime=state.scenario.briefing?.openingTime||"";`;
if(!scenarioText.includes(activateOld))throw new Error("activateScenario patch target not found");
scenarioText=scenarioText.replace(activateOld,activateNew);

fs.writeFileSync(stateFile,stateText,"utf8");
fs.writeFileSync(scenarioFile,scenarioText,"utf8");
console.log("V154_NPC_MATERIALIZATION_PATCH_APPLIED");
