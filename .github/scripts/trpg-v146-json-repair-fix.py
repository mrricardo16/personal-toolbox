from pathlib import Path

path = Path('.github/scripts/trpg-v146-json-repair.py')
text = path.read_text(encoding='utf-8')
old = 'if(quote===\'"\'&&lookahead&&!",:}]".includes(lookahead))'
new = 'if(quote===\'"\'&&lookahead&&!",:}]，：；".includes(lookahead))'
if old not in text:
    raise RuntimeError('无法定位中文结构标点引号边界')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
