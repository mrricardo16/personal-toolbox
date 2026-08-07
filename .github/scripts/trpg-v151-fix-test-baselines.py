from pathlib import Path

# Situation UI regression is feature-specific; it should only require a valid semantic version.
path=Path('trpg-dm-assistant/build/test-situation-ui.js')
text=path.read_text(encoding='utf-8')
old='test("正式版本为 v1.5.0",()=>assert.ok(library.includes(\'const APP_VERSION = "1.5.0";\')));'
new='test("正式版本字段有效",()=>assert.match(library,/const APP_VERSION = "\\d+\\.\\d+\\.\\d+";/));'
if old not in text:
    raise RuntimeError('无法定位 situation UI 旧版本断言')
path.write_text(text.replace(old,new,1),encoding='utf-8')

# v1.5.0 experience is a compatibility regression suite. Later v1.5.x versions must retain
# those behaviors, so assert a version floor rather than exact equality.
path=Path('trpg-dm-assistant/build/test-v150-experience.js')
text=path.read_text(encoding='utf-8')
old='test("版本升级为 v1.5.0",()=>assert.ok(library.includes(\'const APP_VERSION = "1.5.0";\')));'
new='test("版本不低于 v1.5.0",()=>{const match=library.match(/const APP_VERSION = "(\\d+)\\.(\\d+)\\.(\\d+)";/);assert.ok(match);const version=match.slice(1).map(Number);assert.ok(version[0]>1||(version[0]===1&&version[1]>=5))});'
if old not in text:
    raise RuntimeError('无法定位 v1.5.0 experience 旧版本断言')
path.write_text(text.replace(old,new,1),encoding='utf-8')
