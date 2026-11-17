import test from 'node:test'
import assert from 'node:assert/strict'
import { writingSkillForDocument, createVersion, selectedTextMatches } from '../src/writingStrategies.js'
test('document type maps to one draft skill', () => {
  assert.equal(writingSkillForDocument('summary'), 'draft-summary')
  assert.equal(writingSkillForDocument('meeting'), 'draft-meeting')
  assert.equal(writingSkillForDocument('research'), 'draft-report')
  assert.equal(writingSkillForDocument('notice'), 'draft-formal')
})
test('history snapshots preserve originals and cap memory', () => {
  let versions = []
  for (let id = 1; id <= 25; id++) versions = createVersion(versions, id, '草稿', String(id), 'now')
  assert.equal(versions.length, 20)
  assert.equal(versions[0].id, 6)
  assert.equal(versions.at(-1).content, '25')
})
test('selection range uses exact UTF-16 offsets', () => {
  const text = '标题\n第一段内容。\n第二段内容。'
  const start = text.indexOf('第二段')
  assert.ok(selectedTextMatches(text, { start, end: text.length, text: '第二段内容。' }))
  assert.ok(!selectedTextMatches(text + '新增', { start, end: text.length, text: '其它内容' }))
})
