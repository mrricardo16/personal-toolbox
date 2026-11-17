import test from 'node:test'
import assert from 'node:assert/strict'
import { criticalConflicts, approvedGroups } from '../src/annualGuard.js'

test('critical conflicts block without an explanation', () => {
  const item = { included: true, conflicts: [{ severity: 'critical', resolution: 'confirmed', note: '' }] }
  assert.equal(criticalConflicts([item]).length, 1)
  item.conflicts[0].note = '以3月验收报告为准'
  assert.equal(criticalConflicts([item]).length, 0)
})
test('excluded groups do not block summary generation', () => {
  assert.equal(criticalConflicts([
    { included: false, conflicts: [{ severity: 'critical', resolution: 'pending' }] }
  ]).length, 0)
})
test('normal unresolved concerns remain visible in approved materials', () => {
  const facts = [{ id:'A-1', title:'设备巡检', sourceFile:'一月.docx', evidence:'巡检二十次',
    period:'一月', project:'巡检', progress:'完成', description:'巡检20次',
    numericEvidence:'20次', evidenceMatched:true }]
  const groups = [{ included:true, title:'设备巡检', kind:'recurring',
    summary:'开展常规巡检', metrics:'', memberIds:['A-1'],
    conflicts:[{severity:'normal', description:'累计口径尚未确认', resolution:'pending'}] }]
  const results = approvedGroups(groups, facts)
  assert.equal(results.length,1)
  assert.equal(results[0].evidences[0].originalQuote,'巡检二十次')
  assert.deepEqual(results[0].unresolvedNonCritical,['累计口径尚未确认'])
})
