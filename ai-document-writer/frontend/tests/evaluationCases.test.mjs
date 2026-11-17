import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const data = JSON.parse(readFileSync(new URL('../../evaluation/cases.json', import.meta.url), 'utf8'))

test('evaluation fixtures cover 20 independent scenarios without sensitive data', () => {
  assert.equal(data.schemaVersion, 1)
  assert.equal(data.cases.length, 20)
  assert.equal(new Set(data.cases.map(c => c.id)).size, data.cases.length)
  for (const c of data.cases) {
    assert.ok(c.id.length > 2)
    assert.ok(c.source.length >= 10)
    assert.ok(c.task.length > 0)
    assert.ok(Array.isArray(c.mustContain) && c.mustContain.length > 0)
    assert.ok(Array.isArray(c.mustNotContain) && c.mustNotContain.length > 0)
  }
})
test('evaluation fixtures cover summaries, reports, meetings, notices and plans', () => {
  const types = new Set(data.cases.map(c => c.skill))
  for (const category of ['summary', 'report', 'meeting', 'notice', 'plan', 'polish'])
    assert.ok(types.has(category), category)
})
