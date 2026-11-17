// Stable comparison and skill selection rules. Pure functions for regression tests.
export function writingSkillForDocument(type) {
  // Editing/outline-only legacy skills are not a license to draft new content.
  if (type === 'polish' || type === 'outline') return null
  if (type === 'proofread') return 'review-facts'
  if (type === 'summary') return 'draft-summary'
  if (type === 'meeting') return 'draft-meeting'
  if (type === 'report' || type === 'research' || type === 'briefing') return 'draft-report'
  return 'draft-formal'
}
export function createVersion(history, id, label, content, createdAt) {
  return [...history, { id, label, content, createdAt }].slice(-20)
}
export function selectedTextMatches(content, selection) {
  const { start, end, text } = selection || {}
  return Number.isInteger(start) && Number.isInteger(end) && start >= 0 &&
    end > start && end <= content.length && content.slice(start, end) === text
}
