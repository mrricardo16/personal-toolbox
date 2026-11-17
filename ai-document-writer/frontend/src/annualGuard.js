// Pure review rules, independent of Vue and the LLM. Testable with Node's test runner.
export function criticalConflicts(groups) {
  return (groups || []).flatMap(group => group.included
    ? (group.conflicts || []).filter(conflict =>
        conflict.severity === 'critical' &&
        (conflict.resolution !== 'confirmed' || !(conflict.note || '').trim()))
    : [])
}
export function approvedGroups(groups, facts) {
  const lookup = Object.fromEntries(facts.map(f => [f.id, f]))
  return groups.filter(g => g.included).map(g => ({
    group: g.title, category: g.kind, summary: g.summary,
    metrics: g.metrics,
    evidences: g.memberIds.map(id => lookup[id]).filter(Boolean).map(f => ({
      file: f.sourceFile, period: f.period, project: f.project, title: f.title,
      progress: f.progress, content: f.description, originalQuote: f.evidence,
      quoteMatched: f.evidenceMatched, numericEvidence: f.numericEvidence
    })),
    confirmedNotes: (g.conflicts || []).filter(c => c.resolution === 'confirmed')
      .map(c => ({ issue: c.description, userDecision: c.note })),
    unresolvedNonCritical: (g.conflicts || []).filter(c =>
      c.severity !== 'critical' && c.resolution !== 'confirmed').map(c => c.description)
  }))
}

export function attachPendingQuestions(content, groups) {
  const pending = (groups || []).filter(g => g.included)
    .flatMap(g => g.conflicts || [])
    .filter(c => c.severity !== 'critical' && c.resolution !== 'confirmed')
    .map(c => c.description?.trim()).filter(Boolean)
  if (!pending.length) return content
  const unique = [...new Set(pending)]
  return (content || '').trimEnd() + '\n\n【待核实事项（系统提示）】\n'
    + unique.map((question, index) => (index + 1) + '. ' + question).join('\n')
}

export function buildAnnualSourceDocuments(files, manualMaterial = '') {
  const docs = (files || []).filter(file => file.role !== 'style')
    .map(file => ({ id: 'F' + file.id, fileName: file.name,
      month: file.month || '', content: file.content }))
  if (manualMaterial.trim()) docs.push({ id: 'manual', fileName: '手动输入的事实材料',
    month: '', content: manualMaterial.trim() })
  return docs
}
