"use strict";
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../src/npc-knowledge-boundary.js");
let text=fs.readFileSync(file,"utf8");

const normalizerAnchor="\nfunction npcKnowledgeInitialFactIds(npcId)";
const normalizerBlock=`
const __npcKnowledgeBaseNormalizeDirectorSituation=normalizeDirectorSituation;
normalizeDirectorSituation=function(raw){
  const source=isPlainObject(raw)?raw:{},normalized=__npcKnowledgeBaseNormalizeDirectorSituation(raw);
  normalized.knowledgeFacts=Array.isArray(source.knowledgeFacts)?source.knowledgeFacts.map(normalizeNpcKnowledgeFact).slice(0,NPC_KNOWLEDGE_MAX_FACTS):[];
  return normalized
};
`;
if(!text.includes("__npcKnowledgeBaseNormalizeDirectorSituation")){
  if(!text.includes(normalizerAnchor))throw new Error("NPC knowledge normalizer anchor missing");
  text=text.replace(normalizerAnchor,"\n"+normalizerBlock+normalizerAnchor);
}

const sanitizeAnchor="\nfunction npcKnowledgeNarrativeSegmentLeaks(";
const sanitizeBlock=`
const __npcKnowledgeBaseSanitizeNpcChange=npcKnowledgeSanitizeNpcChange;
npcKnowledgeSanitizeNpcChange=function(change,violations){
  if(change&&["updateNpc","addNpc"].includes(change.operation)){
    delete change.knowledgeClueIds;
    delete change.knowledgeFactIds;
    delete change.__npcKnowledgeValidated;
  }
  return __npcKnowledgeBaseSanitizeNpcChange(change,violations)
};
`;
if(!text.includes("__npcKnowledgeBaseSanitizeNpcChange")){
  if(!text.includes(sanitizeAnchor))throw new Error("NPC knowledge sanitize anchor missing");
  text=text.replace(sanitizeAnchor,"\n"+sanitizeBlock+sanitizeAnchor);
}

const prepareAnchor="\nfunction npcKnowledgeContext()";
const prepareBlock=`
function npcKnowledgeTraditionalNpcPatchEffect(change){return ["description","attitude","claim","relationship","currentIntent","lastInteraction"].some(key=>change?.[key]!==undefined)}
const __npcKnowledgeBasePrepareStateChanges=prepareStateChanges;
prepareStateChanges=function(changes,campaignChanges=[],validationContext={}){
  const source=Array.isArray(changes)?changes:[],knowledgeOnly=[];
  const routed=source.filter(change=>{
    const trusted=change?.operation==="updateNpc"&&change?.__npcKnowledgeValidated===NPC_KNOWLEDGE_BOUNDARY_VERSION;
    const hasKnowledge=(change?.knowledgeClueIds||[]).length||(change?.knowledgeFactIds||[]).length;
    if(trusted&&hasKnowledge&&!npcKnowledgeTraditionalNpcPatchEffect(change)){knowledgeOnly.push(deepClone(change));return false}
    return true
  });
  const prepared=__npcKnowledgeBasePrepareStateChanges(routed,campaignChanges,validationContext);
  for(const change of knowledgeOnly){
    const npc=prepared.draft.npcs.find(item=>item.id===change.npcId);
    if(!npc)throw protocolError("STATE_CHANGE_PARAMETER_INVALID",`NPC 不存在：${change.npcId}`);
    applyNpcContinuityPatch(npc,change);
    prepared.summaries.push(`NPC 知识更新：${npc.name||npc.id}`);
    prepared.count=Number(prepared.count||0)+1;
    prepared.stateCount=Number(prepared.stateCount||0)+1
  }
  return prepared
};
`;
if(!text.includes("__npcKnowledgeBasePrepareStateChanges")){
  if(!text.includes(prepareAnchor))throw new Error("NPC knowledge prepareStateChanges anchor missing");
  text=text.replace(prepareAnchor,"\n"+prepareBlock+prepareAnchor);
}

for(const marker of ["__npcKnowledgeBaseNormalizeDirectorSituation","__npcKnowledgeBaseSanitizeNpcChange","__npcKnowledgeBasePrepareStateChanges"])if(!text.includes(marker))throw new Error(`NPC knowledge integration patch missing: ${marker}`);
fs.writeFileSync(file,text,"utf8");
console.log("V1511_NORMALIZER_PATCH:PASS");
