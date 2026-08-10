"use strict";
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../src/npc-knowledge-boundary.js");
let text=fs.readFileSync(file,"utf8");
const anchor="\nfunction npcKnowledgeInitialFactIds(npcId)";
const block=`
const __npcKnowledgeBaseNormalizeDirectorSituation=normalizeDirectorSituation;
normalizeDirectorSituation=function(raw){
  const source=isPlainObject(raw)?raw:{},normalized=__npcKnowledgeBaseNormalizeDirectorSituation(raw);
  normalized.knowledgeFacts=Array.isArray(source.knowledgeFacts)?source.knowledgeFacts.map(normalizeNpcKnowledgeFact).slice(0,NPC_KNOWLEDGE_MAX_FACTS):[];
  return normalized
};
`;
if(!text.includes("__npcKnowledgeBaseNormalizeDirectorSituation")){
  if(!text.includes(anchor))throw new Error("NPC knowledge normalizer anchor missing");
  text=text.replace(anchor,"\n"+block+anchor);
}
if(!text.includes("__npcKnowledgeBaseNormalizeDirectorSituation"))throw new Error("NPC knowledge normalizer patch failed");
fs.writeFileSync(file,text,"utf8");
console.log("V1511_NORMALIZER_PATCH:PASS");
