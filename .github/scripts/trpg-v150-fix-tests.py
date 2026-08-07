from pathlib import Path

path = Path('trpg-dm-assistant/build/test-situation-ui.js')
text = path.read_text(encoding='utf-8')
old = 'const APP_VERSION = "1.4.6";'
new = 'const APP_VERSION = "1.5.0";'
if old not in text:
    raise RuntimeError('无法定位旧版情境测试版本断言')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
