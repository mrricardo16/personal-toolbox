<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { selectedTextMatches } from './writingStrategies.js'

const props = defineProps({
  content: { type: String, default: '' },
  versions: { type: Array, required: true },
  selection: { type: Object, default: () => ({ start: 0, end: 0, text: '' }) },
  model: { type: String, required: true },
  thinkingType: { type: String, required: true },
  reasoningEffort: { type: String, required: true },
  keySource: { type: String, required: true },
  keyInput: { type: String, default: '' },
  protectedTerms: { type: String, default: '' },
  factContext: { type: String, default: '' }
})
const emit = defineEmits(['accept', 'restore', 'save'])
const instruction = ref('')
const scope = ref('full')
const improveStyle = ref(false)
const candidate = ref('')
const sourceSnapshot = ref('')
const busy = ref(false)
const error = ref('')
const message = ref('')
const compareId = ref('')
let controller = null

const selectionValid = computed(() => selectedTextMatches(props.content, props.selection))
const stale = computed(() => !!candidate.value && props.content !== sourceSnapshot.value)
const comparable = computed(() => props.versions.find(v => String(v.id) === String(compareId.value)))
const changedPreview = computed(() => {
  if (!candidate.value || !sourceSnapshot.value) return null
  const a = sourceSnapshot.value, b = candidate.value
  let prefix = 0
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++
  let suffix = 0
  while (suffix < a.length - prefix && suffix < b.length - prefix &&
    a[a.length - suffix - 1] === b[b.length - suffix - 1]) suffix++
  return {
    before: a.slice(prefix, a.length - suffix || a.length),
    after: b.slice(prefix, b.length - suffix || b.length)
  }
})
async function revise() {
  if (busy.value) return
  error.value = ''
  message.value = ''
  if (!props.content.trim()) { error.value = '请先生成或填写当前稿件'; return }
  if (!instruction.value.trim()) { error.value = '请输入具体修改要求'; return }
  if (scope.value === 'selection' && !selectionValid.value) {
    error.value = '请先在下方正文编辑框中选中要修改的文字'
    return
  }
  controller = new AbortController()
  const original = props.content
  busy.value = true
  candidate.value = ''
  try {
    const response = await fetch('/api/writing/revise', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Writer-Client': 'ai-document-writer' },
      body: JSON.stringify({
        chat: {
          model: props.model, keySource: props.keySource,
          temporaryApiKey: props.keySource === 'temporary' ? props.keyInput.trim() : null,
          thinkingType: props.thinkingType, reasoningEffort: props.reasoningEffort
        },
        currentText: original, instruction: instruction.value.trim(),
        scope: scope.value,
        selectionStart: scope.value === 'selection' ? props.selection.start : null,
        selectionEnd: scope.value === 'selection' ? props.selection.end : null,
        factContext: props.factContext.slice(0, 18000),
        protectedTerms: props.protectedTerms,
        improveStyle: improveStyle.value
      })
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || payload.detail || payload.title || 'HTTP ' + response.status)
    sourceSnapshot.value = original
    candidate.value = payload.candidateText
    message.value = '修订候选稿已生成' +
      (Number.isFinite(payload.usage?.total_tokens) ? '，消耗 ' + payload.usage.total_tokens + ' Token' : '') +
      '。请确认后再采纳'
  } catch (e) {
    error.value = e.name === 'AbortError' ? '已取消，当前稿件未变' : '修订失败：' + e.message
  } finally { busy.value = false; controller = null }
}
function accept() {
  if (busy.value || !candidate.value || stale.value) return
  emit('accept', {
    content: candidate.value,
    label: scope.value === 'selection' ? '局部修订' : '全文修订',
    instruction: instruction.value.trim()
  })
  candidate.value = ''
  message.value = '已采纳为新版本'
}
function discard() { candidate.value = ''; message.value = '已放弃候选稿，原稿保持不变' }
function exportHistory() {
  if (!props.versions.length) return
  const safe = props.versions.map(v => ({ id: v.id, label: v.label, content: v.content, createdAt: v.createdAt }))
  const blob = new Blob([JSON.stringify({ format: 'ai-writer-versions-v1', versions: safe }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'AI文档助手-稿件版本.json'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
watch(() => props.content, () => { if (!candidate.value) error.value = '' })
onUnmounted(() => controller?.abort())
</script>

<template>
  <section class="panel revision-workspace">
    <h2>继续修改当前稿件</h2>
    <p class="hint">对已有文稿提出具体修改意见，不再从空白重生成。局部修改只替换选中的文字；未选中部分由程序原样保留。候选稿不会自动覆盖当前稿件。</p>
    <label>本轮修改要求
      <textarea v-model="instruction" rows="3" maxlength="2500" placeholder="例如：第二部分保留所有数字，补充具体做法，删除空话；其他段落不要修改" />
    </label>
    <div class="revision-settings">
      <label><input type="radio" name="revision-scope" value="full" v-model="scope" /> 修改全文</label>
      <label><input type="radio" name="revision-scope" value="selection" v-model="scope" /> 仅修改选中内容</label>
      <label><input type="checkbox" v-model="improveStyle" /> 加载语言优化 Skill</label>
    </div>
    <p v-if="scope === 'selection'" class="hint">
      {{ selectionValid ? '已选中 ' + selection.text.length + ' 个字符；模型只返回此段替换文本' : '请先在下面正文中用鼠标或键盘选中目标段落' }}
    </p>
    <div class="toolbar">
      <button class="primary" :disabled="busy || !content.trim()" @click="revise">生成修改候选稿</button>
      <button :disabled="!busy" @click="controller?.abort()">停止本轮修订</button>
    </div>
    <p v-if="error" class="notice" role="alert">{{ error }}</p>
    <p v-else-if="message" class="status" role="status">{{ message }}</p>
    <template v-if="candidate">
      <div v-if="stale" class="notice">当前正文在候选稿生成后已变化。请重新生成候选稿，避免覆盖新的手动修改。</div>
      <div class="compare-columns">
        <div><strong>修改前</strong><pre>{{ sourceSnapshot }}</pre></div>
        <div><strong>候选修改后</strong><pre>{{ candidate }}</pre></div>
      </div>
      <details v-if="changedPreview">
        <summary>仅查看发生变化的文本范围</summary>
        <div class="compare-columns">
          <pre>{{ changedPreview.before || '（空）' }}</pre>
          <pre>{{ changedPreview.after || '（空）' }}</pre>
        </div>
      </details>
      <div class="toolbar">
        <button class="primary" :disabled="stale" @click="accept">采纳候选稿（保存新版本）</button>
        <button @click="discard">放弃本次修改</button>
      </div>
    </template>
    <div class="versions">
      <h3>本次会话中的版本记录</h3>
      <p class="hint">只保存在当前页面内存中；刷新页面会清空。需要长期留存时请导出版本记录 JSON。</p>
      <div class="toolbar">
        <button :disabled="!content.trim()" @click="emit('save', { content, label: '手动保存' })">保存当前正文为版本</button>
        <button :disabled="!versions.length" @click="exportHistory">导出版本记录 JSON</button>
      </div>
      <div v-if="versions.length" class="revision-version-list">
        <div v-for="version in [...versions].reverse()" :key="version.id" class="revision-version">
          <div><strong>{{ version.label }}</strong><small>{{ version.createdAt }} · {{ version.content.length }} 字</small></div>
          <button :disabled="version.content === content" @click="emit('restore', version)">恢复此版本</button>
        </div>
      </div>
      <label v-if="versions.length > 1">对照历史版本（不影响当前正文）
        <select v-model="compareId">
          <option value="">不对照</option>
          <option v-for="version in versions" :key="version.id" :value="String(version.id)">{{ version.label }} · {{ version.createdAt }}</option>
        </select>
      </label>
      <div v-if="comparable" class="compare-columns">
        <div><strong>所选历史版本</strong><pre>{{ comparable.content }}</pre></div>
        <div><strong>当前正文</strong><pre>{{ content }}</pre></div>
      </div>
    </div>
  </section>
</template>
