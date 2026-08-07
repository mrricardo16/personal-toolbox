from pathlib import Path

path = Path(".github/scripts/trpg-save-hotfix.py")
text = path.read_text(encoding="utf-8")
old = "binding_start = ui.find('  const saveBtn=$(\"#saveNowBtn\");')\nbinding_end = ui.find(\"  $$('[data-modal-close]')\", binding_start)"
new = "dynamic_start = ui.find(\"function bindDynamicEvents(){\")\nbinding_start = ui.find('  const saveBtn=$(\"#saveNowBtn\");', dynamic_start)\nbinding_end = ui.find(\"  $$('[data-modal-close]')\", binding_start)"
if old not in text:
    raise RuntimeError("无法定位补丁脚本中的旧事件搜索逻辑")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
