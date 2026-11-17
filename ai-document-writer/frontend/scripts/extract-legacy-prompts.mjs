import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

// The original single-file application is the source of truth for all 13 skills.
// Extract the literal declarations without rewriting any rules.
const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '../..')
const source = readFileSync(resolve(projectRoot, 'index.html'), 'utf8')
const start = source.indexOf('  var baseRules = [')
const end = source.indexOf('  function getValue(id) {', start)
if (start < 0 || end < 0) throw new Error('Legacy prompt block not found: check index.html')
const rules = source.slice(start, end)
  .replace('  var baseRules = [', 'export var baseRules = [')
  .replace('  var skillRules = {', 'export var skillRules = {')
if (!rules.includes('export var skillRules')) throw new Error('Skill rules extraction failed')
writeFileSync(resolve(projectRoot, 'frontend/src/legacyRules.generated.js'), rules, 'utf8')
console.log('Extracted original base rules and 13 writing skills')
