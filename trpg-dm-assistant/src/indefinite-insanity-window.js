"use strict";

/* v1.6.4 Indefinite Insanity Window
 * CoC7 indefinite-insanity tracking is browser-owned. The authoritative
 * Starting SAN baseline is reset only at explicit scenario/chapter boundaries
 * (or investigator creation), and every canonical SAN loss inside that window
 * contributes to the one-fifth threshold. Recovery/expiry is deliberately
 * outside this module.
 */
const INDEFINITE_INSANITY_WINDOW_VERSION="1.0";
const INDEFINITE_INSANITY_WINDOW_AUTHORITY="browser_coc_sanity_window";
const INDEFINITE_INSANITY_EVENT_HISTORY_LIMIT=80;

function indefiniteInsanityThreshold(startingSan){
  const baseline=clamp(Math.floor(Number(startingSan)||0),0,99);
  return Math.floor(baseline/5)
}
function indefiniteWindowSnapshot(character=state.character){
  if(!character||character.system!=="coc7")return null;
  const sanity=isPlainObject(character.sanityState)?character.sanityState:{},raw=isPlainObject(sanity.indefiniteWindow)?sanity.indefiniteWindow:null;
  if(!raw)return null;
  const baseline=clamp(Math.floor(Number(raw.baselineSan)||0),0,99),threshold=indefiniteInsanityThreshold(baseline);
  return{id:asString(raw.id,120)||null,version:INDEFINITE_INSANITY_WINDOW_VERSION,authority:INDEFINITE_INSANITY_WINDOW_AUTHORITY,baselineSan:baseline,thresholdLoss:threshold,accumulatedLoss:Math.max(0,Math.floor(Number(raw.accumulatedLoss)||0)),source:asString(raw.source,40)||"unknown",sourceId:asString(raw.sourceId,160)||null,startedAt:asString(raw.startedAt,80)||null,triggered:raw.triggered===true,triggerEventId:asString(raw.triggerEventId,160)||null}
}
function indefiniteConditionSnapshot(character=state.character){
  if(!character||character.system!=="coc7")return null;const raw=isPlainObject(character.sanityState?.indefiniteInsanity)?character.sanityState.indefiniteInsanity:null;if(!raw)return null;
  return{active:raw.active===true,version:INDEFINITE_INSANITY_WINDOW_VERSION,authority:INDEFINITE_INSANITY_WINDOW_AUTHORITY,triggeredAt:asString(raw.triggeredAt,80)||null,windowId:asString(raw.windowId,120)||null,baselineSan:clamp(Math.floor(Number(raw.baselineSan)||0),0,99),thresholdLoss:Math.max(0,Math.floor(Number(raw.thresholdLoss)||0)),accumulatedLoss:Math.max(0,Math.floor(Number(raw.accumulatedLoss)||0)),sourceEventId:asString(raw.sourceEventId,160)||null,recoveryManaged:false}
}
function indefiniteLossEventsSnapshot(character=state.character){
  const list=Array.isArray(character?.sanityState?.indefiniteLossEvents)?character.sanityState.indefiniteLossEvents:[];
  return list.slice(-INDEFINITE_INSANITY_EVENT_HISTORY_LIMIT).filter(isPlainObject).map(event=>({id:asString(event.id,180),source:asString(event.source,60),sourceId:asString(event.sourceId,160)||null,amount:Math.max(0,Math.floor(Number(event.amount)||0)),accumulatedLoss:Math.max(0,Math.floor(Number(event.accumulatedLoss)||0)),at:asString(event.at,80)||null}))
}

const __v164SanityStateSnapshot=sanityStateSnapshot;
sanityStateSnapshot=function(character=state.character){
  const base=__v164SanityStateSnapshot(character);if(!base)return null;
  const window=indefiniteWindowSnapshot(character),condition=indefiniteConditionSnapshot(character),events=indefiniteLossEventsSnapshot(character);
  return{...base,indefiniteTrackingReady:Boolean(window?.id)&&character?.sanityState?.indefiniteTrackingReady===true,indefiniteWindow:window,indefiniteInsanity:condition,indefiniteLossEvents:events}
};

function beginIndefiniteInsanityWindow(character=state.character,{source="scenario",sourceId=null}={}){
  if(!character||character.system!=="coc7")return null;
  character.sanityState=isPlainObject(character.sanityState)?character.sanityState:{};
  const existingCondition=indefiniteConditionSnapshot(character),baseline=clamp(Math.floor(Number(character.san)||0),0,99),startedAt=nowIso();
  character.sanityState.indefiniteTrackingReady=true;
  character.sanityState.baselineSan=baseline;
  character.sanityState.baselineSource=source;
  character.sanityState.indefiniteWindow={id:uid("san_window"),version:INDEFINITE_INSANITY_WINDOW_VERSION,authority:INDEFINITE_INSANITY_WINDOW_AUTHORITY,baselineSan:baseline,thresholdLoss:indefiniteInsanityThreshold(baseline),accumulatedLoss:0,source:asString(source,40)||"scenario",sourceId:asString(sourceId,160)||null,startedAt,triggered:false,triggerEventId:null};
  character.sanityState.indefiniteLossEvents=[];
  character.sanityState.indefiniteInsanity=existingCondition;
  return deepClone(character.sanityState.indefiniteWindow)
}

const __v164NormalizeSanityState=normalizeSanityState;
normalizeSanityState=function(character=state.character,{newCharacter=false}={}){
  const normalized=__v164NormalizeSanityState(character,{newCharacter});if(!normalized)return null;
  character.sanityState=sanityStateSnapshot(character);
  if(newCharacter)beginIndefiniteInsanityWindow(character,{source:"creation",sourceId:character.name||null});
  return character.sanityState
};

function recordIndefiniteSanLoss(character,amount,{source="canonical_san_loss",sourceId=null}={}){
  if(!character||character.system!=="coc7")return{evaluated:false,trackingReady:false,reason:"not_coc7"};
  normalizeSanityState(character);const sanity=character.sanityState,window=indefiniteWindowSnapshot(character),loss=Math.max(0,Math.floor(Number(amount)||0));
  if(!sanity.indefiniteTrackingReady||!window?.id)return{version:INDEFINITE_INSANITY_WINDOW_VERSION,authority:INDEFINITE_INSANITY_WINDOW_AUTHORITY,evaluated:false,trackingReady:false,reason:"no_authoritative_san_window",sanLoss:loss,immutable:true};
  const stableSourceId=asString(sourceId,160)||uid("san_loss"),eventId=`${asString(source,60)||"canonical_san_loss"}:${stableSourceId}`,events=indefiniteLossEventsSnapshot(character),existing=events.find(event=>event.id===eventId);
  if(existing){const condition=indefiniteConditionSnapshot(character);return{version:INDEFINITE_INSANITY_WINDOW_VERSION,authority:INDEFINITE_INSANITY_WINDOW_AUTHORITY,evaluated:true,trackingReady:true,deduplicated:true,windowId:window.id,baselineSan:window.baselineSan,thresholdLoss:window.thresholdLoss,accumulatedLoss:window.accumulatedLoss,sanLoss:loss,justTriggered:false,active:Boolean(condition?.active),immutable:true}}
  if(loss<=0){const condition=indefiniteConditionSnapshot(character);return{version:INDEFINITE_INSANITY_WINDOW_VERSION,authority:INDEFINITE_INSANITY_WINDOW_AUTHORITY,evaluated:true,trackingReady:true,deduplicated:false,windowId:window.id,baselineSan:window.baselineSan,thresholdLoss:window.thresholdLoss,accumulatedLoss:window.accumulatedLoss,sanLoss:0,justTriggered:false,active:Boolean(condition?.active),immutable:true}}
  const nextAccumulated=window.accumulatedLoss+loss,thresholdReached=nextAccumulated>=window.thresholdLoss,justTriggered=!window.triggered&&thresholdReached,event={id:eventId,source:asString(source,60)||"canonical_san_loss",sourceId:stableSourceId,amount:loss,accumulatedLoss:nextAccumulated,at:nowIso()};
  sanity.indefiniteWindow={...window,accumulatedLoss:nextAccumulated,triggered:window.triggered||thresholdReached,triggerEventId:justTriggered?eventId:window.triggerEventId};
  sanity.indefiniteLossEvents=[...events,event].slice(-INDEFINITE_INSANITY_EVENT_HISTORY_LIMIT);
  if(justTriggered&&!sanity.indefiniteInsanity?.active){sanity.indefiniteInsanity={active:true,version:INDEFINITE_INSANITY_WINDOW_VERSION,authority:INDEFINITE_INSANITY_WINDOW_AUTHORITY,triggeredAt:event.at,windowId:window.id,baselineSan:window.baselineSan,thresholdLoss:window.thresholdLoss,accumulatedLoss:nextAccumulated,sourceEventId:eventId,recoveryManaged:false}}
  const condition=indefiniteConditionSnapshot(character);
  return{version:INDEFINITE_INSANITY_WINDOW_VERSION,authority:INDEFINITE_INSANITY_WINDOW_AUTHORITY,evaluated:true,trackingReady:true,deduplicated:false,windowId:window.id,baselineSan:window.baselineSan,thresholdLoss:window.thresholdLoss,accumulatedLoss:nextAccumulated,sanLoss:loss,justTriggered,active:Boolean(condition?.active),immutable:true}
}

const __v164EnsureSanLossResolution=ensureSanLossResolution;
ensureSanLossResolution=function(record,options={}){
  const resolution=__v164EnsureSanLossResolution(record,options);if(!resolution)return resolution;
  if(resolution.indefiniteInsanity?.windowVersion===INDEFINITE_INSANITY_WINDOW_VERSION)return resolution;
  const evaluation=recordIndefiniteSanLoss(state.character,record?.sanLoss?.amount||0,{source:"san_check",sourceId:record.id});
  resolution.indefiniteInsanity={...deepClone(evaluation),windowVersion:INDEFINITE_INSANITY_WINDOW_VERSION};record.sanResolution=resolution;
  const history=state.character?.sanityState?.history;if(Array.isArray(history)){const index=history.findIndex(item=>item?.recordId===record.id);if(index>=0)history[index]={...history[index],indefiniteInsanity:deepClone(resolution.indefiniteInsanity)}}
  return resolution
};

function applyDraftSanLossToWindow(character,beforeSan,{source,sourceId}){
  const afterSan=Number(character?.san||0),before=Number(beforeSan||0);if(!Number.isFinite(afterSan)||!Number.isFinite(before)||afterSan>=before)return null;
  return recordIndefiniteSanLoss(character,before-afterSan,{source,sourceId})
}

const __v164PrepareAiTransaction=prepareAiTransaction;
prepareAiTransaction=function(parsed,options={}){
  const beforeSan=Number(state.character?.san||0),transaction=__v164PrepareAiTransaction(parsed,options),afterSan=Number(transaction?.prepared?.draft?.character?.san||0);
  if(Number.isFinite(beforeSan)&&Number.isFinite(afterSan)&&afterSan<beforeSan)applyDraftSanLossToWindow(transaction.prepared.draft.character,beforeSan,{source:"ai_transaction",sourceId:`${parsed?.requestId||"request"}:${state.revision}:${beforeSan}->${afterSan}`});
  return transaction
};

const __v164CommitPreparedChanges=commitPreparedChanges;
commitPreparedChanges=function(prepared,requestId){
  const beforeSan=Number(state.character?.san||0),afterSan=Number(prepared?.draft?.character?.san||0);if(Number.isFinite(beforeSan)&&Number.isFinite(afterSan)&&afterSan<beforeSan)applyDraftSanLossToWindow(prepared.draft.character,beforeSan,{source:"browser_prepared_changes",sourceId:`${requestId||"request"}:${state.revision}:${beforeSan}->${afterSan}`});
  return __v164CommitPreparedChanges(prepared,requestId)
};

const __v164ActivateScenario=activateScenario;
activateScenario=function(inputScenario){
  const result=__v164ActivateScenario(inputScenario);if(state.character?.system==="coc7"){beginIndefiniteInsanityWindow(state.character,{source:"scenario",sourceId:state.scenario?.id||null});bumpRevision();addLog("san_window",`更新 Starting SAN 窗口：${state.character.sanityState.indefiniteWindow.baselineSan}，不定期疯狂阈值 ${state.character.sanityState.indefiniteWindow.thresholdLoss}`,{secret:false})}return result
};

const __v164EnterNode=enterNode;
enterNode=function(nodeId,options={}){
  const previousChapterId=state.campaign?.currentChapterId||null,result=__v164EnterNode(nodeId,options),currentChapterId=state.campaign?.currentChapterId||null;
  if(state.character?.system==="coc7"&&previousChapterId&&currentChapterId&&previousChapterId!==currentChapterId){beginIndefiniteInsanityWindow(state.character,{source:"chapter",sourceId:currentChapterId});bumpRevision();addLog("san_window",`章节切换，更新 Starting SAN 窗口：${state.character.sanityState.indefiniteWindow.baselineSan}，阈值 ${state.character.sanityState.indefiniteWindow.thresholdLoss}`,{secret:false})}
  return result
};

const __v164SanResolutionContext=sanResolutionContext;
sanResolutionContext=function(record=null){
  const base=__v164SanResolutionContext(record),sanity=state.character?.system==="coc7"?sanityStateSnapshot(state.character):null;
  return{...base,indefiniteInsanity:{implemented:true,version:INDEFINITE_INSANITY_WINDOW_VERSION,authority:INDEFINITE_INSANITY_WINDOW_AUTHORITY,window:sanity?.indefiniteWindow?deepClone(sanity.indefiniteWindow):null,active:sanity?.indefiniteInsanity?deepClone(sanity.indefiniteInsanity):null,trackingReady:sanity?.indefiniteTrackingReady===true,policy:"starting_san_one_fifth_browser_window_counts_canonical_losses"}}
};

const __v164BuildSystemPrompt=buildSystemPrompt;
buildSystemPrompt=function(){return `${__v164BuildSystemPrompt()}\n27. Indefinite Insanity Window：不定期疯狂的 Starting SAN、1/5 阈值、scenario/chapter 累计 SAN 损失和触发状态均由浏览器决定。不得修改、重置、减少累计损失，不得自行解除 active 状态；只能叙述 browser context 中的结果。受限时继续正常玩家交互，不得以疯狂规则制造技术死路。`};
