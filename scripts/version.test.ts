import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextVersion } from './version.ts'

test('the next version follows the Conventional Commits since the last release', () => {
  assert.equal(nextVersion(null, []), '0.1.0', 'first release')
  assert.equal(nextVersion('0.1.0', []), null, 'nothing merged')
  assert.equal(nextVersion('0.1.0', ['chore: deps', 'ci(release): cache', 'docs: readme']), null, 'nothing users get')
  assert.equal(nextVersion('0.1.3', ['fix: crash on #', 'chore: x']), '0.1.4')
  assert.equal(nextVersion('0.1.3', ['perf(export): faster']), '0.1.4')
  assert.equal(nextVersion('0.1.3', ['fix: a', 'feat(timeline): b']), '0.2.0')
  assert.equal(nextVersion('0.9.3', ['feat!: new format']), '1.0.0')
  assert.equal(nextVersion('0.9.3', ['refactor(projects): x\n\nBREAKING CHANGE: old bundles no longer open']), '1.0.0')
  assert.equal(nextVersion('1.2.3', ['Feature: no prefix', 'fixed: typo', 'feat : spaced', 'featx: y']), null, 'only exact types count')
  assert.equal(nextVersion('1.2.3', ['chore: x\n\n* feat: from a squashed commit list']), null, 'only subjects count')
})
