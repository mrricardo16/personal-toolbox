<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { baseRules, skillRules } from './legacyRules.generated.js'
import AnnualWorkspace from './AnnualWorkspace.vue'
import RevisionWorkspace from './RevisionWorkspace.vue'
import { createVersion, writingSkillForDocument } from './writingStrategies.js'

const skillLabels = {
  general: '通用正式材料', notice: '通知', report: '工作报告',
  summary: '工作总结', plan: '工作方案', briefing: '工作简报',
  meeting: '会议纪要', request: '请示', speech: '讲话稿',
  research: '调研报告', polish: '忠实润色', proofread: '校对纠错',
  outline: '提纲整理'
}
const mode = ref('general')
const skill = ref('general')
const prompt = ref('')
const model = ref('deepseek-flash')
const thinkingType = ref('disabled')
const reasoningEffort = ref('high')
const lengthLevel = ref('标准')
const docTitle = ref('')
const audience = ref('')
const protectedTerms = ref('')
const sourceMaterial = ref('')
const taskRequirement = ref('')
const extraInstruction = ref('')
const strictFacts = ref(true)
const appendReview = ref(true)
const autoReview = ref(false)
const writingStrategy = ref('skills')
const enhanceWriting = ref(false)
const availableSkills = ref([])
const versions = ref([])
const editorSelection = ref({ start: 0, end: 0, text: '' })
let versionSequence = 0
const allowGeneralSuggestions = ref(false)
const result = ref('')
const status = ref('')
const busy = ref(false)
const audit = ref('')
const tokenUsage = ref(0)
const files = ref([])
const uploadBusy = ref(false)
const templateChoice = ref('auto')
const preserveHeaderFooter = ref(false)
const templateCandidate = computed(() => {
  if (templateChoice.value === 'default') return null
  if (templateChoice.value !== 'auto') return files.value.find(f => String(f.id) === templateChoice.value) || null
  return files.value.find(f => f.role === 'style' && /年度|总结|模板|范文/.test(f.name))
    || files.value.find(f => f.role === 'style')
    || files.value.find(f => f.role === 'both')
    || files.value[0] || null
})
const serverKeyConfigured = ref(false)
const savedKeyConfigured = ref(false)
const canManageKey = ref(false)
const keySource = ref('temporary')
const keyInput = ref('')
const showKey = ref(false)
const totalCharacters = computed(() => files.value.reduce((n, f) => n + f.content.length, 0))
let activeController = null
let nextId = 1

function switchSkill() {
  prompt.value = baseRules + '\n\n【当前技能】\n' + skillRules[skill.value]
}
watch(skill, switchSkill)
switchSkill()

async function api(path, method = 'GET', body, signal) {
  const headers = { 'X-Writer-Client': 'ai-document-writer' }
  if (!(body instanceof FormData) && body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(path, {
    method, headers,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    signal
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || data.detail || data.title || 'HTTP ' + response.status)
  return data
}
async function loadSettings() {
  try {
    const info = await api('/api/settings/status')
    serverKeyConfigured.value = info.serverKeyConfigured
    savedKeyConfigured.value = info.savedKeyConfigured
    canManageKey.value = info.canManageKey
    keySource.value = info.savedKeyConfigured ? 'saved' : info.serverKeyConfigured ? 'server' : 'temporary'
    try { availableSkills.value = (await api('/api/skills')).skills || [] }
    catch { availableSkills.value = [] }
  } catch (error) { status.value = '无法连接后端：' + error.message }
}
onMounted(loadSettings)
async function saveKey() {
  try {
    if (!keyInput.value.trim()) throw new Error('请先输入 API Key')
    await api('/api/settings/key', 'POST', { apiKey: keyInput.value.trim() })
    keyInput.value = ''
    savedKeyConfigured.value = true
    keySource.value = 'saved'
    status.value = 'API Key 已保存到当前计算机的受保护用户目录'
  } catch (error) { status.value = '保存失败：' + error.message }
}
async function removeKey() {
  try {
    await api('/api/settings/key', 'DELETE')
    savedKeyConfigured.value = false
    keySource.value = serverKeyConfigured.value ? 'server' : 'temporary'
    status.value = '已清除持久化 API Key'
  } catch (error) { status.value = '清除失败：' + error.message }
}
async function uploadDocuments(event) {
  const selected = Array.from(event.target.files || [])
  event.target.value = ''
  if (!selected.length) return
  if (selected.length + files.value.length > 15) {
    status.value = '一次最多维护 15 个文件，请先移除部分文件'
    return
  }
  if (selected.some(f => !f.name.toLowerCase().endsWith('.docx'))) {
    status.value = '仅允许上传 .docx 文件'
    return
  }
  const form = new FormData()
  selected.forEach(f => form.append('files', f))
  uploadBusy.value = true
  status.value = '正在读取 DOCX 正文与表格……'
  try {
    const data = await api('/api/documents/parse', 'POST', form)
    for (const [index, doc] of data.documents.entries()) {
      files.value.push({
        id: nextId++, name: doc.fileName, content: doc.content,
        role: 'facts', month: '', tableCount: doc.tableCount,
        originalFile: selected[index]
      })
    }
    status.value = '已解析 ' + data.documents.length + ' 个文件。请检查每份文件的参考用途'
  } catch (error) { status.value = '解析失败：' + error.message }
  finally { uploadBusy.value = false }
}
function setAllRoles(role) { files.value.forEach(f => { f.role = role }) }
function getMaterials() {
  const facts = files.value
    .filter(f => f.role !== 'style')
    .map(f => '【文件：' + f.name + '；所属月份：' + (f.month || '未指定') + '】\n' + f.content)
  const styles = files.value
    .filter(f => f.role !== 'facts')
    .map(f => '【格式与语言参考文件：' + f.name + '（不得把其中的事实作为本次事实）】\n' + f.content)
  return { factText: [sourceMaterial.value.trim(), ...facts].filter(Boolean).join('\n\n'),
    styleText: styles.join('\n\n') }
}
function buildUserPrompt() {
  const { factText, styleText } = getMaterials()
  const factRule = strictFacts.value
    ? '启用严格事实模式。材料没有明确给出的事实必须使用【待补充】或【需核实】，不得补造。'
    : '仍不得虚构事实；对一般结构性内容可适度补全，但必须避免形成新的事实判断。'
  const suggestionRule = allowGeneralSuggestions.value
    ? '允许提出一般性建议，但必须明确标注为“建议”。'
    : '不允许补充材料外建议，只能依据材料写作。'
  const reviewRule = appendReview.value
    ? '正文之后增加“待补充与核验事项”；没有则写“无”。'
    : '只输出正文，但正文中的待补充和需核实标记必须保留。'
  return [
    '请按照系统规则完成以下任务。',
    '【文档标题】', docTitle.value.trim() || '【未提供标题】',
    '【使用对象 / 报送对象】', audience.value.trim() || '【未提供使用对象】',
    '【篇幅要求】', lengthLevel.value,
    '【必须原样保留的内容】', protectedTerms.value.trim() || '无单独列出的保护项；仍须保留原材料专有名词、数字、日期和单位。',
    '【事实材料 / 原文】', factText || '【未提供事实材料】',
    '【仅供风格与结构参考的材料】', styleText || '无',
    '【具体任务】', taskRequirement.value.trim() || '【未提供具体任务】',
    '【附加要求】', extraInstruction.value.trim() || '无',
    '【本次执行规则】', factRule, suggestionRule, reviewRule,
    '仅供风格参考的材料不得贡献本次事实，不得复制其过往数据、日期和结果。',
    '直接输出完整文稿，不解释写作过程。'
  ].join('\n\n')
}
function buildReviewPrompt(draft) {
  const { factText } = getMaterials()
  return [
    '你现在进行第二轮“忠实审校”。请直接输出审校后的完整终稿，不要输出审校过程。',
    '审校目标：',
    '1. 修正语病、重复、逻辑跳跃、层级混乱和不准确的泛化表达。',
    '2. 删除或改为【待补充】/【需核实】的无依据事实。',
    '3. 绝对不得新增人名、机构、政策、文件文号、日期、数据、成果、决定、责任主体或原因结论。',
    '4. 不得改变已完成、进行中、计划中、建议等事项状态。',
    '5. 下列保护内容必须原样保留，不得改字、改数字、改符号或调整大小写。',
    '【保护内容】', protectedTerms.value || '无单独列出的保护项',
    '【原始事实材料】', factText || '【未提供事实材料】',
    '【原始任务】', taskRequirement.value || '【未提供具体任务】',
    '【待审校初稿】', draft
  ].join('\n\n')
}
function auditTerms(text) {
  const terms = protectedTerms.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  if (!terms.length) return ''
  const missing = terms.filter(s => !text.includes(s))
  return missing.length ? '名词核验未通过：' + missing.join('、') : '指定保护项原样检查通过'
}
async function chat(systemPrompt, userPrompt, writingSkillId = null, enhancementSkillId = null) {
  const response = await api('/api/llm/chat', 'POST', {
    model: model.value, systemPrompt, userPrompt,
    keySource: keySource.value,
    temporaryApiKey: keySource.value === 'temporary' ? keyInput.value.trim() : null,
    thinkingType: thinkingType.value, reasoningEffort: reasoningEffort.value,
    writingSkillId, enhancementSkillId
  }, activeController.signal)
  if (Number.isFinite(response.usage?.total_tokens)) tokenUsage.value += response.usage.total_tokens
  return response
}

function recordVersion(label, content) {
  if (!content?.trim()) return
  const timestamp = new Date().toLocaleString('zh-CN')
  versions.value = createVersion(versions.value, ++versionSequence, label, content, timestamp)
  result.value = content
  audit.value = auditTerms(content)
}
function saveWorkingText() {
  if (result.value.trim() && versions.value.at(-1)?.content !== result.value)
    recordVersion('生成前的当前稿件', result.value)
}
function restoreVersion(version) {
  if (!version?.content) return
  saveWorkingText()
  result.value = version.content
  audit.value = auditTerms(result.value)
  status.value = '已恢复历史版本；原始版本记录未删除'
}
function captureSelection(event) {
  const element = event?.target
  if (!element || typeof element.selectionStart !== 'number') return
  const start = element.selectionStart, end = element.selectionEnd
  if (end > start) editorSelection.value = {
    start, end, text: result.value.slice(start, end)
  }
}
function clearCurrent() {
  if (result.value && !window.confirm('确定清空当前正文？已有的版本快照仍会保留在页面内。')) return
  result.value = ''
  status.value = '当前正文已清空，已存版本仍可恢复'
  audit.value = ''
}
function receiveRevision(payload) {
  recordVersion(payload.label + '：' + payload.instruction.slice(0, 28), payload.content)
  status.value = '修改已采纳，可继续提出要求或导出'
}
async function compareDrafts() {
  if (busy.value || mode.value !== 'general') return
  const { factText } = getMaterials()
  if (!factText.trim() && !taskRequirement.value.trim()) {
    status.value = '请先填写事实或写作要求'
    return
  }
  const userPrompt = buildUserPrompt()
  if (userPrompt.length > 100000) {
    status.value = '材料过长，无法执行 A/B 对照'
    return
  }
  const chosenSkill = writingSkillForDocument(skill.value)
  if (!chosenSkill) {
    status.value = '该文种仍使用经典 Prompt，尚未配置独立 Skill；无需发起无意义的双请求'
    return
  }
  saveWorkingText()
  busy.value = true
  activeController = new AbortController()
  try {
    status.value = 'A/B：正在用经典 Prompt 生成版本 A……'
    const classic = await chat(prompt.value, userPrompt)
    recordVersion('A · 经典 Prompt', classic.content)
    status.value = 'A/B：正在用同样材料生成 Skill 版本 B……'
    const enhanced = await chat(prompt.value, userPrompt, chosenSkill,
      enhanceWriting.value ? 'improve-style' : null)
    recordVersion('B · Skill 增强', enhanced.content)
    status.value = 'A/B 两版已保存。可在下方版本记录中切换对比（实际使用了两次模型请求）'
  } catch (error) {
    status.value = 'A/B 中断，已成功生成的版本仍保留：' + error.message
  } finally {
    busy.value = false
    activeController = null
  }
}

async function generate() {
  if (busy.value) return
  if (mode.value !== 'general') {
    status.value = '年度总结结构化归并将在 P2 开发，本版本不提供未经核验的自动年度汇总'
    return
  }
  const { factText } = getMaterials()
  if (!factText.trim() && !taskRequirement.value.trim()) {
    status.value = '请至少填写事实材料或具体任务'
    return
  }
  const userPrompt = buildUserPrompt()
  if (userPrompt.length > 100000) {
    status.value = '材料超过当前单次模型请求上限；请减少材料。P2 将支持分段分析'
    return
  }
  saveWorkingText()
  tokenUsage.value = 0
  busy.value = true
  activeController = new AbortController()
  try {
    status.value = '正在生成初稿……'
    const draft = await chat(prompt.value, userPrompt,
      writingStrategy.value === 'skills' ? writingSkillForDocument(skill.value) : null,
      writingStrategy.value === 'skills' && writingSkillForDocument(skill.value) && enhanceWriting.value ? 'improve-style' : null)
    recordVersion(writingStrategy.value === 'skills' ? 'Skill 初稿' : '经典 Prompt 初稿', draft.content)
    status.value = '初稿已生成并保留为独立版本，可继续修改'
    if (autoReview.value) {
      try {
        status.value = '初稿已生成，正在忠实审校……'
        const checked = await chat(baseRules + '\n\n当前任务是忠实审校。不得扩大、补造或改写事实。', buildReviewPrompt(draft.content),
          writingStrategy.value === 'skills' ? 'review-facts' : null)
        if (checked.content && checked.content.trim()) recordVersion('忠实审校稿', checked.content)
        status.value = '审校完成；初稿仍保留在版本记录中'
      } catch (error) {
        status.value = '审校未完成，已保留初稿：' + (error.name === 'AbortError' ? '用户取消' : error.message)
      }
    }
    audit.value = auditTerms(result.value)
  } catch (error) {
    status.value = error.name === 'AbortError' ? '已停止生成' : '生成失败：' + error.message
  } finally {
    busy.value = false
    activeController = null
  }
}
function cancel() { activeController?.abort() }
async function copyResult() {
  if (!result.value) return
  try { await navigator.clipboard.writeText(result.value); status.value = '已复制结果' }
  catch { status.value = '复制失败，请手动选择文本复制' }
}
async function download(extension) {
  if (extension === 'docx') { await exportDocx(); return }
  if (!result.value) return
  const name = (docTitle.value.trim() || '生成文档').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
  const mime = extension === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
  const blob = new Blob(['\uFEFF' + result.value], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = name + '.' + extension; link.click()
  URL.revokeObjectURL(url)
}

async function exportDocx() {
  if (!result.value.trim()) { status.value = '请先生成文稿或填写编辑结果'; return }
  const form = new FormData()
  form.append('content', result.value)
  form.append('title', docTitle.value.trim() || '生成文档')
  form.append('preserveHeaderFooter', String(preserveHeaderFooter.value))
  if (templateCandidate.value?.originalFile) form.append('template', templateCandidate.value.originalFile)
  try {
    status.value = '正在生成可编辑的 Word 文档……'
    const response = await fetch('/api/documents/export', {
      method: 'POST', headers: { 'X-Writer-Client': 'ai-document-writer' }, body: form
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || data.title || 'HTTP ' + response.status)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safe = (docTitle.value.trim() || '生成文档').replace(/[\\/:*?"<>|]/g, '_').slice(0, 70)
    link.href = url
    link.download = safe + '.docx'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    status.value = 'Word 文档已生成（可在 Word/WPS 中继续编辑）'
  } catch (e) { status.value = 'Word 导出失败：' + e.message }
}
function onAnnualGenerated(payload) {
  saveWorkingText()
  recordVersion(payload.message?.includes('审校') ? '年度总结·审校稿' : '年度总结·初稿', payload.content)
  status.value = payload.message
}

</script>

<template>
  <main class="shell">
    <header class="header">
      <div>
        <h1>AI 文档助手 <small>V2.2 · Skill 协作改稿</small></h1>
        <p>原版 Prompt 可回退，支持经审核的 Skill、定向改稿与稿件版本比较。</p>
      </div>
      <a href="/legacy.html" target="_blank" rel="noopener">打开原版页面</a>
    </header>
    <nav class="tabs" aria-label="写作模式">
      <button :class="{ active: mode === 'general' }" @click="mode = 'general'">常规文档写作</button>
      <button :class="{ active: mode === 'annual' }" @click="mode = 'annual'">年度 / 多月总结</button>
    </nav>
    <div v-if="mode === 'annual'" class="notice">年度总结先分析各篇事实，再进行归并和冲突检查。建议在生成前检查来源及统计口径。</div>

    <section class="panel">
      <h2>一、模型与 API Key</h2>
      <div class="grid">
        <label>模型
          <select v-model="model"><option value="deepseek-flash">deepseek-flash（推荐）</option><option value="deepseek-v4-pro">deepseek-v4-pro</option><option value="deepseek-v4-flash">deepseek-v4-flash（旧兼容名称）</option></select>
        </label>
        <label>思考模式
          <select v-model="thinkingType"><option value="disabled">关闭</option><option value="enabled">开启</option></select>
        </label>
        <label>思考强度
          <select v-model="reasoningEffort" :disabled="thinkingType !== 'enabled'"><option value="low">low</option><option value="high">high</option><option value="max">max</option></select>
        </label>
        <label>Key 来源
          <select v-model="keySource">
            <option value="server" :disabled="!serverKeyConfigured">后端 JSON 配置{{ serverKeyConfigured ? '（已配置）' : '（未配置）' }}</option>
            <option value="saved" :disabled="!savedKeyConfigured">本机已保存 Key{{ savedKeyConfigured ? '（已配置）' : '（未配置）' }}</option>
            <option value="temporary">临时 Key（不保存）</option>
          </select>
        </label>
      </div>
      <div class="key-line">
        <label v-if="keySource === 'temporary' || canManageKey">API Key
          <input v-model="keyInput" :type="showKey ? 'text' : 'password'" autocomplete="off" placeholder="sk-..." />
        </label>
        <button v-if="keySource === 'temporary' || canManageKey" type="button" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button>
        <button v-if="canManageKey" type="button" @click="saveKey">保存至本机</button>
        <button v-if="canManageKey && savedKeyConfigured" type="button" @click="removeKey">删除本机 Key</button>
      </div>
      <p class="hint">仅桌面本机模式允许网页持久化 Key。服务端 JSON 的 Key 不会返回给浏览器。</p>
    </section>

    <section class="panel">
      <h2>二、文档技能</h2>
      <div class="grid">
        <label>文档类型
          <select v-model="skill"><option v-for="(label, id) in skillLabels" :key="id" :value="id">{{ label }}</option></select>
        </label>
        <label>篇幅
          <select v-model="lengthLevel"><option>简洁</option><option>标准</option><option>详细</option></select>
        </label>
      </div>
      <div class="grid">
        <label>写作引擎
          <select v-model="writingStrategy">
            <option value="skills">本地写作 Skill（实验）</option>
            <option value="legacy">经典 Prompt（兼容模式）</option>
          </select>
        </label>
        <label>语言优化
          <select v-model="enhanceWriting" :disabled="writingStrategy !== 'skills'">
            <option :value="false">不加载额外优化 Skill</option>
            <option :value="true">加载中文表达优化 Skill</option>
          </select>
        </label>
      </div>
      <p class="hint">Skill 按文种选择性加载，不会执行第三方脚本；经典模式保留旧 Prompt。当前内置 {{ availableSkills.length }} 项审核过的本地 Skill，效果尚待真实材料对照。</p>
      <label>系统指令（可编辑）<textarea v-model="prompt" rows="7" /></label>
      <p class="hint">规则直接从原版 index.html 的 13 种文档技能提取，避免迁移时丢失原 Prompt 内容。</p>
    </section>

    <section class="panel">
      <h2>三、DOCX 参考文件</h2>
      <input id="upload" type="file" accept=".docx" multiple :disabled="uploadBusy" @change="uploadDocuments"/>
      <p class="hint">最多 15 个文件；解析正文与表格，暂不识别图片。文件在后端内存中解析，不持久化原文件。</p>
      <div v-if="files.length" class="toolbar">
        <span>已上传 {{ files.length }} 个 · 约 {{ totalCharacters }} 字符</span>
        <button @click="setAllRoles('facts')">批量设为事实</button>
        <button @click="setAllRoles('style')">批量设为风格</button>
        <button @click="setAllRoles('both')">批量设为两者</button>
      </div>
      <div v-for="file in files" :key="file.id" class="file-row">
        <div class="file-name"><strong>{{ file.name }}</strong><small>{{ file.content.length }} 字 · {{ file.tableCount }} 个表格</small></div>
        <select v-model="file.role" :aria-label="file.name + ' 文件用途'">
          <option value="facts">事实材料</option>
          <option value="style">只参考风格 / 结构</option>
          <option value="both">事实 + 风格</option>
        </select>
        <input v-model="file.month" type="month" :aria-label="file.name + ' 所属月份'" />
        <button type="button" @click="files = files.filter(f => f.id !== file.id)">移除</button>
      </div>

    </section>

    <section class="panel">
      <h2>四、写作信息</h2>
      <div class="grid">
        <label>文档标题<input v-model="docTitle" placeholder="可留空"/></label>
        <label>使用对象 / 报送对象<input v-model="audience" placeholder="例如：各科室、上级主管部门"/></label>
      </div>
      <label>必须原样保留的名称、数据（每行一项）<textarea v-model="protectedTerms" rows="3"/></label>
      <label>事实材料 / 原文（可与上传文件一起使用）<textarea v-model="sourceMaterial" rows="6"/></label>
      <label>具体写作要求<textarea v-model="taskRequirement" rows="4" placeholder="请描述写作目标、范围、重点和结构要求"/></label>
      <label>附加要求<textarea v-model="extraInstruction" rows="2"/></label>
      <div class="checks">
        <label><input v-model="strictFacts" type="checkbox"/>严格事实模式</label>
        <label><input v-model="appendReview" type="checkbox"/>附待补充与核验事项</label>
        <label><input v-model="autoReview" type="checkbox"/>生成后追加审校稿（不覆盖初稿）</label>
        <label><input v-model="allowGeneralSuggestions" type="checkbox"/>允许标注为建议的一般性补充</label>
      </div>
    </section>

    <AnnualWorkspace
      v-if="mode === 'annual'"
      :files="files"
      :model="model"
      :thinking-type="thinkingType"
      :reasoning-effort="reasoningEffort"
      :key-source="keySource"
      :key-input="keyInput"
      :task-requirement="taskRequirement"
      :audience="audience"
      :length-level="lengthLevel"
      :extra-instruction="extraInstruction"
      :append-review="appendReview"
      :source-material="sourceMaterial"
      :doc-title="docTitle"
      :protected-terms="protectedTerms"
      :strict-facts="strictFacts"
      :auto-review="autoReview"
      :allow-general-suggestions="allowGeneralSuggestions"
      :style-prompt="prompt"
      :writing-strategy="writingStrategy"
      :enhance-writing="enhanceWriting"
      @generated="onAnnualGenerated"
    />
    <section class="panel">
      <h2>{{ mode === 'annual' ? '六' : '五' }}、Word 模板设置</h2>
      <label>导出排版来源
        <select v-model="templateChoice">
          <option value="auto">自动推荐：优先风格参考文件</option>
          <option value="default">使用默认 Word 排版</option>
          <option v-for="file in files" :key="file.id" :value="String(file.id)">指定：{{ file.name }}</option>
        </select>
      </label>
      <p class="hint">当前选择：{{ templateCandidate ? templateCandidate.name : '默认 Word 排版' }}。保留模板样式和页面设置，原正文不会复制到新文档。</p>
      <label><input v-model="preserveHeaderFooter" type="checkbox"/>保留模板的原页眉页脚文字（可能包含往年日期、单位名称；默认关闭）</label>
      <p class="hint">保留原页眉页脚文字前，请自行核对其中是否包含过期资料。</p>
    </section>
    <section class="panel">
      <h2>{{ mode === 'annual' ? '七' : '六' }}、生成结果（可直接编辑）</h2>
      <div class="toolbar">
        <button class="primary" :disabled="busy || uploadBusy || mode !== 'general'" @click="generate">生成新稿</button>
        <button :disabled="busy || uploadBusy || mode !== 'general'" @click="compareDrafts">A/B 对照经典与 Skill（2次调用）</button>
        <button :disabled="!busy" @click="cancel">停止</button>
        <button @click="copyResult">复制</button>
        <button @click="download('md')">下载 Markdown</button>
        <button @click="download('txt')">下载 TXT</button>
        <button @click="download('docx')">下载 Word DOCX</button>
        <a class="revision-link" href="#revision-workspace">继续提出修改意见</a>
        <button @click="clearCurrent">清空当前正文</button>
      </div>
      <p class="status" role="status">{{ status }} <span v-if="tokenUsage">（本次已报告 {{ tokenUsage }} Token）</span></p>
      <p v-if="audit" class="audit">{{ audit }}</p>
      <textarea class="result" v-model="result" rows="18" placeholder="生成结果会出现在这里，也可以选中部分内容要求 AI 修改" @select="captureSelection" @mouseup="captureSelection" @keyup="captureSelection"/>
    </section>
    <RevisionWorkspace
      id="revision-workspace"
      :content="result"
      :versions="versions"
      :selection="editorSelection"
      :model="model"
      :thinking-type="thinkingType"
      :reasoning-effort="reasoningEffort"
      :key-source="keySource"
      :key-input="keyInput"
      :protected-terms="protectedTerms"
      :fact-context="getMaterials().factText"
      @accept="receiveRevision"
      @save="({ label, content }) => recordVersion(label, content)"
      @restore="restoreVersion"
    />
    <footer>本工具会将参与写作的材料发送至配置的模型 API。请勿上传涉密或未经授权对外传输的资料。</footer>
  </main>
</template>
