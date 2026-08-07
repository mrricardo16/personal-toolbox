from pathlib import Path

path = Path('.github/scripts/trpg-v150-release.py')
text = path.read_text(encoding='utf-8')
old = '''# 旧返回行动阶段改为编辑后重发语义。
ai = replace_regex(
    ai,
    r'function returnToActionStage\\(\\)\\{.*?\\n\\}',
    'function returnToActionStage(){return editFailedAction()}',
    "返回行动阶段兼容函数",
    flags=re.S,
)
'''
new = '''# 旧返回行动阶段改为编辑后重发语义。旧函数是单行，必须精确替换，禁止跨函数正则。
ai = replace_once(
    ai,
    'function returnToActionStage(){if(activeAbortController||state.runtime.activeRequestId)throw new Error("当前请求尚未结束");const failed=state.runtime.failedRequest;if(failed?.action)state.runtime.pendingPlayerAction=failed.action;state.runtime.failedRequest=null;state.runtime.lastError=null;state.runtime.lastRawAiResponse=null;state.runtime.lastContinuationPayload=null;setPhase("awaiting_player_action",{force:true});scheduleAutosave();renderAll()}',
    'function returnToActionStage(){return editFailedAction()}',
    "返回行动阶段兼容函数",
)
'''
if old not in text:
    raise RuntimeError('无法定位跨函数 returnToActionStage 替换块')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
