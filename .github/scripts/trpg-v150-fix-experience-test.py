from pathlib import Path

path = Path('trpg-dm-assistant/build/test-v150-experience.js')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()
changed = False
for index, line in enumerate(lines):
    if '技术详情默认折叠' in line:
        lines[index] = 'test("技术详情默认折叠",()=>{assert.ok(ui.includes("<details><summary>技术详情"))});'
        changed = True
    if '补丁保持 v1.4.6' in line:
        lines[index] = line.replace('补丁保持 v1.4.6', '正式版本为 v1.5.0')
if not changed:
    raise RuntimeError('无法定位技术详情测试')
path.write_text('\n'.join(lines) + '\n', encoding='utf-8')

legacy = Path('trpg-dm-assistant/build/test-situation-ui.js')
legacy_text = legacy.read_text(encoding='utf-8').replace('补丁保持 v1.4.6', '正式版本为 v1.5.0')
legacy.write_text(legacy_text, encoding='utf-8')
