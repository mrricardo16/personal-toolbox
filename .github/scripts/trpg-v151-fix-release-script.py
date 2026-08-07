from pathlib import Path

path=Path('.github/scripts/trpg-v151-investigation-stability.py')
text=path.read_text(encoding='utf-8')
old='scenario = replace_between(scenario, "function buildContextSnapshot(", "function endingConditionMatches", context_fn + "\\nfunction endingConditionMatches", "buildContextSnapshot")'
new='scenario = replace_between(scenario, "function buildContextSnapshot(", "function endingConditionMatches", context_fn, "buildContextSnapshot")'
if old not in text:
    raise RuntimeError('无法定位 buildContextSnapshot 替换边界')
path.write_text(text.replace(old,new,1),encoding='utf-8')
