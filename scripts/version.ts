// `node scripts/version.ts`: the version the commits since the last release call for, from their
// Conventional Commit subjects, or nothing when none of them changes the app. CI runs it after each
// merge to main and releases what it prints. Releases are tagged v<version>; the tags are the
// source of truth, package.json's version is a placeholder CI overwrites before packaging.
import { execFileSync } from 'node:child_process'

/** The next version after `last` (null before the first release), given the commit messages since it. */
export function nextVersion(last: string | null, messages: string[]): string | null {
  if (!last) return '0.1.0'
  const subjects = messages.map((m) => m.split('\n')[0])
  const [major, minor, patch] = last.split('.').map(Number)
  if (subjects.some((s) => /^\w+(\(.+\))?!:/.test(s)) || messages.some((m) => /^BREAKING[ -]CHANGE:/m.test(m))) return `${major + 1}.0.0`
  if (subjects.some((s) => /^feat(\(.+\))?:/.test(s))) return `${major}.${minor + 1}.0`
  if (subjects.some((s) => /^(fix|perf)(\(.+\))?:/.test(s))) return `${major}.${minor}.${patch + 1}`
  return null
}

if (import.meta.main) {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  let tag: string | null = null
  try {
    tag = git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*').trim()
  } catch {} // no release yet
  const messages = tag ? git('log', '--format=%B%x00', `${tag}..HEAD`).split('\0').map((m) => m.trim()).filter(Boolean) : []
  console.log(nextVersion(tag?.slice(1) ?? null, messages) ?? '')
}
