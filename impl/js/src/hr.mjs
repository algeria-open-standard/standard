// What the format .hr adds to the core (formats/hr/README.md): which parts a
// segment must hold, and that every segment of a file is about one person.
import { open, readHeader } from './container.mjs'

export const HR = { id: 'hr', version: '0.1', profile: 'employee-file' }
export const REQUIRED = ['hr.identity', 'hr.employment']

// letters and digits of any script, without accents or marks, without case: a name in Arabic stays a name
const squash = (v) => String(v ?? '').normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/** What identifies the person of an identity part: the national number when there is one, the name and the date of birth otherwise. */
export function subjectKeys(identity) {
  const p = identity?.person ?? {}
  const nin = (p.identifiers ?? []).find((i) => i.scheme === 'dz:nin')?.value
  return { nin: nin ? squash(nin) : null, civil: `${squash(p.familyName)}|${squash(p.givenNames)}|${p.birth?.date ?? ''}` }
}

/**
 * Checks of the format, on top of the verification of the core. Returns
 * findings in the same shape: { level, code, message, segment }.
 */
export function checkHr(bytes) {
  const findings = []
  const file = open(bytes)
  let subject = null
  for (const s of file.segments) {
    const { header, problems } = readHeader(s)
    if (!header || problems.length) continue
    for (const type of REQUIRED) {
      if (!header.parts.some((p) => p.type === type)) findings.push({ level: 'error', code: 'hr-part-missing', message: `a segment of a .hr file must hold a part of type ${type}`, segment: s.sequence })
    }
    const part = header.parts.find((p) => p.type === 'hr.identity')
    const data = part && s.files.get(part.path)
    if (!data) {
      if (part) findings.push({ level: 'warning', code: 'hr-identity-withheld', message: 'the identity of the person was withheld from this segment: it cannot be told whose it is', segment: s.sequence })
      continue
    }
    let keys
    try {
      keys = subjectKeys(JSON.parse(data.toString('utf8')))
    } catch {
      findings.push({ level: 'error', code: 'hr-identity', message: 'the identity part is not JSON', segment: s.sequence })
      continue
    }
    if (subject) {
      // one person: the same national number when both segments give one, the same name and date of birth otherwise
      const same = subject.nin && keys.nin ? subject.nin === keys.nin : subject.civil === keys.civil
      if (!same) findings.push({ level: 'error', code: 'hr-subject', message: `segment ${s.sequence} is about another person than segment ${subject.sequence}`, segment: s.sequence })
    } else subject = { ...keys, sequence: s.sequence }
  }
  return findings
}
