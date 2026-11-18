import { randomInt, randomUUID } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { buildDraftPrompt, writingOutputIssue, writingSkillForDocument } from '../frontend/src/writingStrategies.js'

const { values: options } = parseArgs({ options: {
  url: { type: 'string', default: 'http://127.0.0.1:5080' },
  model: { type: 'string', default: 'deepseek-flash' },
  repetitions: { type: 'string', default: '2' },
  case: { type: 'string', multiple: true },
  output: { type: 'string' },
  run: { type: 'boolean', default: false }
} })
const endpoint = new URL('/api/llm/chat', options.url)
if (!['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) || !['http:', 'https:'].includes(endpoint.protocol)) {
  throw new Error('评测请求只允许发往本机 HTTP(S) 应用')
}
const repetitions = Number(options.repetitions)
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) throw new Error('重复次数必须为 1–10')
const cases = JSON.parse(await readFile(new URL('./cases.json', import.meta.url), 'utf8')).cases
const selected = options.case?.length ? options.case.map(id => {
  const fixture = cases.find(item => item.id === id)
  if (!fixture) throw new Error('未找到评测案例 ' + id)
  return fixture
}) : cases
const active = selected.filter(item => writingSkillForDocument(item.skill))
console.log(JSON.stringify({
  requests: active.length * 2 * repetitions, repetitions, model: options.model,
  cases: active.map(item => item.id), skipped: selected.filter(item => !active.includes(item)).map(item => item.id)
}))
if (options.run) {
  if (!options.output || !active.length) throw new Error('运行需提供 --output 和至少一个可用 Skill 的案例')
  const { baseRules, skillRules } = await import('../frontend/src/legacyRules.generated.js')
  const output = resolve(options.output)
  await mkdir(output)
  const temporaryApiKey = process.env.AIWRITER_EVAL_API_KEY?.trim()
  const settings = {
    model: options.model, thinkingType: 'disabled', reasoningEffort: 'high',
    keySource: temporaryApiKey ? 'temporary' : 'server',
    temporaryApiKey: temporaryApiKey || null
  }
  const manifest = []
  async function save(name, data) {
    await writeFile(resolve(output, name), JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' })
  }

  try {
    for (const fixture of active) {
      const requirements = {
        title: fixture.title || '', audience: fixture.audience || '',
        length: fixture.length || '标准', task: fixture.task, extra: fixture.extra || '',
        protectedTerms: fixture.protectedTerms || '', strictFacts: true, appendReview: true,
        allowGeneralSuggestions: false
      }
      if (Array.isArray(requirements.protectedTerms)) requirements.protectedTerms = requirements.protectedTerms.join('\n')
      const systemPrompt = baseRules + '\n\n【当前技能】\n' + skillRules[fixture.skill]
      const userPrompt = buildDraftPrompt({ factText: fixture.source, styleText: '' }, requirements)
      for (let repetition = 1; repetition <= repetitions; repetition++) {
        const arms = ['classic', 'skills']
        if (randomInt(2)) arms.reverse()
        for (const arm of arms) {
          const response = await fetch(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Writer-Client': 'ai-document-writer' },
            redirect: 'error', signal: AbortSignal.timeout(400_000),
            body: JSON.stringify({ ...settings, systemPrompt, userPrompt,
              writingSkillId: arm === 'skills' ? writingSkillForDocument(fixture.skill) : null })
          })
          if (!response.ok) throw new Error('模型请求失败，HTTP ' + response.status)
          const result = await response.json()
          const sampleId = randomUUID()
          await save(sampleId + '.json', {
            caseId: fixture.id, repetition, content: result.content,
            hardChecks: {
              missing: fixture.mustContain.filter(value => !result.content.includes(value)),
              unexpected: fixture.mustNotContain.filter(value => result.content.includes(value)),
              outputIssue: writingOutputIssue(result.content, requirements, fixture.source)
            }
          })
          manifest.push({ sampleId, caseId: fixture.id, repetition, arm, totalTokens: result.usage?.total_tokens })
        }
      }
    }
  } finally {
    await save('blind-key.json', {
      model: settings.model, repetitions, thinkingType: settings.thinkingType,
      reasoningEffort: settings.reasoningEffort, generatedAt: new Date().toISOString(), samples: manifest
    })
  }
}
