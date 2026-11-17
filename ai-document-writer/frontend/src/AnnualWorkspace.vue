<script setup>
import { computed, ref, watch } from 'vue'
import { criticalConflicts, approvedGroups, attachPendingQuestions, buildAnnualSourceDocuments } from './annualGuard.js'

const props = defineProps({
  files: { type: Array, required: true },
  model: { type: String, required: true },
  thinkingType: { type: String, required: true },
  reasoningEffort: { type: String, required: true },
  keySource: { type: String, required: true },
  keyInput: { type: String, default: '' },
  taskRequirement: { type: String, default: '' },
  audience: { type: String, default: '' },
  lengthLevel: { type: String, default: '标准' },
  extraInstruction: { type: String, default: '' },
  appendReview: { type: Boolean, default: true },
  sourceMaterial: { type: String, default: '' },
  docTitle: { type: String, default: '' },
  protectedTerms: { type: String, default: '' },
  strictFacts: { type: Boolean, default: true },
  autoReview: { type: Boolean, default: true },
  allowGeneralSuggestions: { type: Boolean, default: false },
  stylePrompt: { type: String, default: '' }
})
const emit = defineEmits(['generated'])
const stage = ref('idle')
const progress = ref('')
const error = ref('')
const facts = ref([])
const groups = ref([])
const autoGenerate = ref(true)
const showDetails = ref(false)
const totalTokens = ref(0)
function addUsage(usage) { if (Number.isFinite(usage?.total_tokens)) totalTokens.value += usage.total_tokens }
const busy = ref(false)
const stepIndex = ref(0)
const stepTotal = ref(0)
let controller = null

const sourceDocs = computed(() => buildAnnualSourceDocuments(props.files, props.sourceMaterial))
const estimatedExtractionCalls = computed(() => sourceDocs.value.reduce(
  (sum, file) => sum + Math.ceil(file.content.length / 18000), 0
))
const blocking = computed(() => criticalConflicts(groups.value))
const normalPending = computed(() => groups.value.flatMap(g => g.included ? g.conflicts || [] : [])
  .filter(c => c.severity !== 'critical' && c.resolution !== 'confirmed'))
const confirmedCount = computed(() => groups.value.filter(g => g.included).length)
const kindLabels = { progress:'跨月进展', recurring:'周期性工作', duplicate:'重复记录', independent:'独立事项' }
const chatSettings = () => ({
  model: props.model, keySource: props.keySource,
  temporaryApiKey: props.keySource === 'temporary' ? props.keyInput.trim() : null,
  thinkingType: props.thinkingType, reasoningEffort: props.reasoningEffort
})
async function call(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Writer-Client': 'ai-document-writer' },
    body: JSON.stringify(body), signal: controller.signal
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || payload.detail || payload.title || 'HTTP ' + response.status)
  return payload
}
function cancel() { controller?.abort() }
function reset() {
  if (busy.value) return
  stage.value = 'idle'
  facts.value = []
  groups.value = []
  error.value = ''
  progress.value = ''
  totalTokens.value = 0
}
watch(
  () => JSON.stringify([
    props.files.map(f => [f.id, f.role, f.month, f.content.length]),
    props.sourceMaterial, props.taskRequirement
  ]),
  () => {
    if (busy.value) controller?.abort()
    else if (stage.value !== 'idle') reset()
  }
)
async function startAnalysis() {
  if (busy.value) return
  if (!sourceDocs.value.length) { error.value = '请上传至少一份事实材料，或填写手动事实材料'; return }
  if (!props.taskRequirement.trim()) { error.value = '请填写具体写作要求及总结时间范围'; return }
  if (sourceDocs.value.length > 16) { error.value = '当前最多处理 15 份上传文档加 1 份手工材料'; return }
  controller = new AbortController()
  busy.value = true
  stage.value = 'extract'
  error.value = ''
  groups.value = []
  facts.value = []
  stepIndex.value = 0
  stepTotal.value = sourceDocs.value.length
  try {
    for (const doc of sourceDocs.value) {
      if (doc.content.length > 150000) throw new Error(doc.fileName + ' 超过 150000 字符，请拆分')
      progress.value = '正在提取：' + doc.fileName + '（' + (stepIndex.value + 1) + '/' + stepTotal.value + '）'
      const res = await call('/api/annual/extract', { document: doc, chat: chatSettings() })
      if (facts.value.length + res.items.length > 250)
        throw new Error('工作事项已超过 250 项；为避免多余 API 消耗，请缩小总结范围或分批整理')
      facts.value.push(...res.items)
      addUsage(res.usage)
      stepIndex.value++
    }
    if (!facts.value.length) throw new Error('没有提取到可核实的工作事项，请检查上传内容')
    stage.value = 'merge'
    progress.value = '正在归并 ' + facts.value.length + ' 项工作事实'
    const merged = await call('/api/annual/merge', {
      facts: facts.value, requirement: props.taskRequirement, chat: chatSettings()
    })
    addUsage(merged.usage)
    groups.value = merged.groups.map(g => ({
      ...g,
      conflicts: (g.conflicts || []).map(c => ({ ...c, note: '' }))
    }))
    stage.value = 'review'
    progress.value = '分析完成：' + groups.value.length + ' 组，' + blocking.value.length + ' 项关键冲突'
    if (autoGenerate.value && !blocking.value.length) await generateInternal()
  } catch (e) {
    error.value = e.name === 'AbortError' ? '已取消，当前结果未作为最终总结使用' : e.message
    stage.value = 'error'
  } finally {
    busy.value = false
    controller = null
  }
}
function approvedMaterials() {
  return approvedGroups(groups.value, facts.value)
}
async function generateInternal() {
  if (blocking.value.length) {
    error.value = '还有 ' + blocking.value.length + ' 项关键冲突未确认；请填写处理依据或排除相关组'
    stage.value = 'review'
    return
  }
  if (!confirmedCount.value) { error.value = '至少保留一组工作事项'; return }
  const data = JSON.stringify(approvedMaterials())
  if (data.length > 85000) { error.value = '整合结果超过单次请求限制，请减少工作事项'; return }
  const styleExamples = props.files.filter(f => f.role !== 'facts')
    .map(f => '【风格参考：' + f.name + '】\n' + f.content.slice(0, 3000)).join('\n\n').slice(0, 6500)
  const system = [
    '你是严谨的企业年度/多月工作总结助手。只依据已核验台账写作。',
    '跨月阶段进展应当形成时间线，不能把每月比例累加。',
    '周期性工作不得误删；只有口径一致且互不重复才可以累计数量。',
    '不能把风格参考材料中的历史事实写入本次报告。',
    '用户对冲突的处理意见应当作为人工指定口径；原始来源仍应忠实表达。',
    '若存在未解决的一般性疑点，文末标记【需核实】而不是得出确定性结论。',
    '不得虚构数据、项目、政策、责任主体、成果或原因。',
    '直接输出完整文稿，遵守用户要求的结构、月份与篇幅。',
    props.stylePrompt.slice(0, 14000)
  ].join('\n')
  const user = [
    '【标题】', props.docTitle || '工作总结',
    '【报送对象】', props.audience || '未指定',
    '【篇幅要求】', props.lengthLevel,
    '【附加要求】', props.extraInstruction || '无',
    '【核验事项】', props.appendReview ? '在文末附待补充与核验事项' : '不单独附录；正文仍须标记无法核实之处',
    '【写作要求】', props.taskRequirement,
    '【必须保留】', props.protectedTerms || '原始证据中的名称、数字、日期、单位',
    '【严格事实模式】', props.strictFacts ? '启用' : '关闭（仍不得虚构事实）',
    '【允许一般性建议】', props.allowGeneralSuggestions ? '仅明确标记为建议时允许' : '不允许',
    '【已归并的事项及来源】', data,
    '【仅供语言与章节结构参考】', styleExamples || '无'
  ].join('\n\n')
  try {
    stage.value = 'generate'
    progress.value = '正在根据确认的台账生成总结……'
    const first = await call('/api/llm/chat', {
      ...chatSettings(), systemPrompt: system, userPrompt: user
    })
    addUsage(first.usage)
    emit('generated', { content: attachPendingQuestions(first.content, groups.value), message: '初稿已生成，可复制或下载' })
    if (props.autoReview) {
      try {
        progress.value = '初稿完成，正在进行忠实审校……'
        const reviewed = await call('/api/llm/chat', {
          ...chatSettings(),
          systemPrompt: '你是事实审校员。修正语言及逻辑表达，不得创造新事实，未确认事项标记【需核实】。',
          userPrompt: '【核验依据】\n' + data + '\n【初稿】\n' + first.content
        })
        addUsage(reviewed.usage)
        if (reviewed.content?.trim()) emit('generated', { content: attachPendingQuestions(reviewed.content, groups.value), message: '年度总结审校完成' })
      } catch (e) {
        if (e.name === 'AbortError') throw e
        emit('generated', { content: attachPendingQuestions(first.content, groups.value), message: '审校失败，已保留初稿：' + e.message })
      }
    }
    stage.value = 'done'
    progress.value = '总结已生成，可在下方直接修改全文并导出 Word'
    error.value = ''
  } catch (e) {
    if (e.name === 'AbortError') { stage.value = 'review'; error.value = '已停止生成，已有初稿会保留' }
    else { stage.value = 'review'; error.value = '生成失败：' + e.message }
  }
}
async function generateApproved() {
  if (busy.value) return
  controller = new AbortController()
  busy.value = true
  error.value = ''
  try { await generateInternal() }
  finally { busy.value = false; controller = null }
}
</script>

<template>
  <section class="panel annual-workspace">
    <h2>五、多月总结分析工作台</h2>
    <p class="hint">逐篇提取可追溯事实 → 归并事项及去重 → 检查冲突 → 生成总结。仅上传文件并不会自动视为内容准确。</p>
    <p class="hint">当前预计至少 {{ estimatedExtractionCalls }} 次分片提取请求，另有归并、生成和审校请求。API 调用可能产生费用。</p>
    <div class="toolbar">
      <label class="auto-toggle"><input type="checkbox" v-model="autoGenerate" />无关键冲突时自动生成</label>
      <button class="primary" :disabled="busy" @click="startAnalysis">重新分析全部事实材料</button>
      <button :disabled="!busy" @click="cancel">取消</button>
      <button :disabled="busy" @click="reset">重置分析</button>
    </div>
    <p class="status" role="status">{{ progress }}</p>
    <p v-if="error" class="notice">{{ error }}</p>
    <div v-if="facts.length" class="analysis-summary">
      <span>已提取 {{ facts.length }} 项工作事实</span>
      <span>归并 {{ groups.length }} 组</span>
      <span>关键待确认 {{ blocking.length }} 项</span>
      <span>本轮 Token：{{ totalTokens || "未返回" }}</span>
      <span>一般疑问 {{ normalPending.length }} 项</span>
      <button @click="showDetails = !showDetails">{{ showDetails ? '收起' : '查看' }}原始事项</button>
    </div>
    <div v-if="showDetails" class="items">
      <details v-for="fact in facts" :key="fact.id">
        <summary>{{ fact.title }} · {{ fact.period }} · {{ fact.sourceFile }} <span v-if="!fact.evidenceMatched">（来源未核对）</span></summary>
        <p>{{ fact.description }} {{ fact.numericEvidence }}</p>
        <blockquote>原文摘录：{{ fact.evidence }}</blockquote>
      </details>
    </div>
    <template v-if="groups.length">
      <h3>归并结果（可编辑）</h3>
      <div v-for="group in groups" :key="group.id" class="group-card">
        <div class="group-header">
          <label><input type="checkbox" v-model="group.included" />纳入总结</label>
          <span>{{ kindLabels[group.kind] || group.kind }} · {{ group.memberIds.length }} 项来源</span>
        </div>
        <label>事项标题<input v-model="group.title"/></label>
        <label>归并说明<textarea v-model="group.summary" rows="2"/></label>
        <label>量化指标及统计口径<input v-model="group.metrics" placeholder="不可证明可累计的指标请留空"/></label>
        <details>
          <summary>查看关联事项及证据</summary>
          <div v-for="f in facts.filter(f => group.memberIds.includes(f.id))" :key="f.id" class="evidence">
            <strong>{{ f.sourceFile }} / {{ f.period }}</strong>：{{ f.description }}
            <small>证据：{{ f.evidence }}</small>
          </div>
        </details>
        <div v-for="(c, idx) in group.conflicts" :key="idx" class="conflict">
          <strong>{{ c.severity === 'critical' ? '关键冲突' : '一般疑问' }}：</strong>{{ c.description }}
          <template v-if="group.included">
            <label>处理状态
              <select v-model="c.resolution">
                <option value="pending">待确认</option>
                <option value="confirmed">已人工确认</option>
              </select>
            </label>
            <label v-if="c.resolution === 'confirmed'">确认依据 / 采用的口径
              <input v-model="c.note" placeholder="必须说明采纳哪个来源或修正后的事实"/>
            </label>
          </template>
        </div>
      </div>
      <div class="toolbar">
        <button class="primary" :disabled="busy || blocking.length > 0 || confirmedCount === 0" @click="generateApproved">根据当前台账生成总结</button>
        <span v-if="blocking.length">尚有 {{ blocking.length }} 项关键冲突，暂不能生成</span>
      </div>
      <p class="hint">人工修改的归并说明、统计指标和冲突处理依据会传入最终写作；请核查其真实性。一般疑问未确认时必须在终稿中注明需核实。</p>
    </template>
  </section>
</template>
