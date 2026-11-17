import test from 'node:test'
import assert from 'node:assert/strict'
import { criticalConflicts, approvedGroups, attachPendingQuestions, buildAnnualSourceDocuments } from '../src/annualGuard.js'

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

test('normal unresolved conflicts are always appended to the generated document', () => {
  const groups = [{ included: true, conflicts: [{ severity:'normal', resolution:'pending',
    description:'统计口径不一致，需要人工确认' }] }]
  const output = attachPendingQuestions('年度工作总结', groups)
  assert.match(output, /待核实事项/)
  assert.match(output, /统计口径不一致/)
  assert.equal(attachPendingQuestions('正文', [{ included: false, conflicts: groups[0].conflicts }]), '正文')
})

test('style-only DOCX is excluded from annual facts but both-role and manual facts remain', () => {
  const materials = [
    { id: 1, name: '往年总结.docx', month: '', content: '往年已取得100项成果', role: 'style' },
    { id: 2, name: '一月.docx', month: '2026-01', content: '完成系统设计', role: 'facts' },
    { id: 3, name: '二月.docx', month: '2026-02', content: '完成系统测试', role: 'both' }
  ]
  const result = buildAnnualSourceDocuments(materials, '补充验收情况')
  assert.deepEqual(result.map(x => x.fileName), ['一月.docx', '二月.docx', '手动输入的事实材料'])
  assert.ok(!JSON.stringify(result).includes('往年已取得100项成果'))
  assert.equal(result[0].id, 'F2')
  assert.equal(result[2].content, '补充验收情况')
})

test('annual writing keeps nearby source context only from approved fact files', () => {
  const fullSource = '业务背景：需要进行设备检查。3月完成设备巡检20次，另发现1项待处理问题。'
  const facts = [{
    id:'F1-1', sourceId:'F1', sourceFile:'3月.docx', period:'2026-03',
    project:'设备巡检', title:'巡检', progress:'已完成',
    description:'完成巡检20次', evidence:'3月完成设备巡检20次',
    evidenceMatched:true, numericEvidence:'20次'
  }]
  const groups = [{
    included:true, title:'设备巡检', kind:'independent', summary:'完成巡检',
    metrics:'20次', memberIds:['F1-1'], conflicts:[]
  }]
  const docs = [{ id:'F1', content:fullSource }, { id:'STYLE', content:'2025年完成500次巡检' }]
  const result = approvedGroups(groups, facts, docs)
  const excerpt = result[0].evidences[0].sourceExcerpt
  assert.match(excerpt, /另发现1项待处理问题/)
  assert.ok(!excerpt.includes('2025年完成500次巡检'))
})
