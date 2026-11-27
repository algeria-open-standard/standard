// An AOS file: a chain of sealed segments in a ZIP container (spec/core.md).
//
//   mimetype                       the kind of file
//   segments/0001/segment.json     the header of a segment: who issues it, what it holds, what it follows
//   segments/0001/seals.json       the seals over the bytes of that header
//   segments/0001/parts/…          the data
//   segments/0001/files/…          attached documents
//   segments/0002/…                what the next issuer added
//
// A segment is never rewritten. Whoever adds one leaves the earlier ones byte
// for byte as received, and names the digest of the one before in its own
// header: its seal then covers its own data and the chain it received.
import { randomUUID } from 'node:crypto'

import { readJson, UTC } from './json.mjs'
import { checkSeal, digest, seal } from './seal.mjs'
import { resolve } from './trust.mjs'
import { ContainerError, readZip, safePath, writeZip } from './zip.mjs'

export const AOS_VERSION = '0.1'
export const mediaType = (format) => `application/vnd.aos.${format}+zip`
const DIGEST = /^sha-(256|384|512):[0-9a-f]+$/
const dirOf = (sequence) => `segments/${String(sequence).padStart(4, '0')}`

/** Opens an archive into its segments, without judging them. Throws a ContainerError on a container the standard refuses. */
export function open(bytes) {
  const files = readZip(bytes)
  const [first] = files.keys()
  if (first !== 'mimetype') throw new ContainerError('the first entry must be "mimetype"')
  const type = files.get('mimetype').toString('ascii')
  const m = /^application\/vnd\.aos\.([a-z][a-z0-9-]*)\+zip$/.exec(type)
  if (!m) throw new ContainerError(`not an AOS file: ${JSON.stringify(type.slice(0, 80))}`)
  const segments = new Map()
  for (const [name, data] of files) {
    if (name === 'mimetype') continue
    const s = /^segments\/(\d{4})\/(.+)$/.exec(name)
    if (!s) throw new ContainerError(`unexpected entry: ${name}`)
    const sequence = Number(s[1])
    const segment = segments.get(sequence) ?? { sequence, dir: dirOf(sequence), files: new Map() }
    segment.files.set(s[2], data)
    segments.set(sequence, segment)
  }
  if (segments.size === 0) throw new ContainerError('the file holds no segment')
  return { format: m[1], mediaType: type, segments: [...segments.values()].sort((a, b) => a.sequence - b.sequence) }
}

/** The header of a segment, parsed, with what is wrong with its shape (an empty list when nothing is). */
export function readHeader(segment) {
  const bytes = segment.files.get('segment.json')
  if (!bytes) return { problems: ['segment.json is missing'] }
  const read = readJson(bytes.toString('utf8'))
  if (read.problem) return { bytes, problems: [`segment.json: ${read.problem}`] }
  const header = read.value
  if (header === null || typeof header !== 'object' || Array.isArray(header)) return { bytes, problems: ['segment.json is not an object'] }
  const problems = []
  const need = (ok, what) => ok || problems.push(what)
  need(header.aos === AOS_VERSION, `"aos" must be "${AOS_VERSION}"`)
  need(typeof header.format?.id === 'string' && typeof header.format?.version === 'string', '"format" must give an id and a version')
  need(header.sequence === segment.sequence, `"sequence" must be ${segment.sequence}, the number of its folder`)
  need(typeof header.id === 'string' && header.id.length > 0, '"id" is missing')
  need(typeof header.createdAt === 'string' && UTC.test(header.createdAt), '"createdAt" must be a date and time in UTC, like 2026-06-30T15:00:00Z')
  need(typeof header.issuer?.name === 'string' && Array.isArray(header.issuer?.identifiers), '"issuer" must give a name and identifiers')
  need(header.previous === null || (Number.isInteger(header.previous?.sequence) && DIGEST.test(header.previous?.digest ?? '')), '"previous" must be null or name a sequence and a digest')
  const seen = new Set()
  for (const p of Array.isArray(header.parts) ? header.parts : (need(false, '"parts" must be a list'), [])) {
    need(safePath(p?.path) && /^(parts|files)\//.test(p.path), `part path not allowed: ${JSON.stringify(p?.path)}`)
    need(!seen.has(p?.path), `part listed twice: ${p?.path}`)
    seen.add(p?.path)
    need(typeof p?.type === 'string' && Number.isInteger(p?.size) && DIGEST.test(p?.digest ?? ''), `part ${p?.path}: type, size and digest are required`)
  }
  return { bytes, header, problems }
}

/**
 * Adds a segment to a file (or starts a file when `bytes` is null), sealed
 * with the keys given. The earlier segments are copied as they are.
 *
 * `parts` is a list of { path ("parts/…" or "files/…"), type, mediaType, data (Buffer) }.
 * `keys` is a list of { jwk (private), kind, role }: the first one is the issuer's.
 * `trust` is the verifier's trust store: what this issuer found when it checked
 * the segment before its own is written into the new header.
 */
export function append(bytes, { format, issuer, producer, parts, keys, trust, createdAt = new Date().toISOString(), id = `urn:uuid:${randomUUID()}` }) {
  const entries = [{ name: 'mimetype', data: Buffer.from(mediaType(format.id), 'ascii') }]
  let previous = null
  let sequence = 1
  if (bytes) {
    const file = open(bytes)
    if (file.format !== format.id) throw new ContainerError(`this is a .${file.format} file, not a .${format.id} file`)
    for (const s of file.segments) for (const [name, data] of s.files) entries.push({ name: `${s.dir}/${name}`, data })
    const last = file.segments.at(-1)
    const { bytes: headerBytes, header, problems } = readHeader(last)
    if (problems.length) throw new ContainerError(`the last segment cannot be followed: ${problems[0]}`)
    sequence = last.sequence + 1
    // what this issuer saw of the seals it builds on, on the day it builds on them
    const seals = sealsOf(last).map((entry) => {
      const info = checkSeal(headerBytes, entry)
      return { keyId: info.keyId ?? null, cryptographic: info.valid ? 'valid' : 'invalid', trust: info.valid ? resolve(info, header, trust).status : 'not-checked' }
    })
    previous = { sequence: last.sequence, digest: digest(headerBytes), checkedAt: createdAt, seals }
  }
  const dir = dirOf(sequence)
  const header = {
    aos: AOS_VERSION,
    format,
    sequence,
    id,
    createdAt,
    issuer,
    ...(producer ? { producer } : {}),
    previous,
    parts: parts.map((p) => ({ path: p.path, type: p.type, mediaType: p.mediaType, size: p.data.length, digest: digest(p.data) })),
  }
  // the bytes written are the bytes sealed: nobody re-serialises a header afterwards
  const headerBytes = Buffer.from(JSON.stringify(header, null, 2) + '\n', 'utf8')
  const seals = { signatures: keys.map((k) => seal(headerBytes, k.jwk, { kind: k.kind, role: k.role, x5c: k.x5c })) }
  entries.push({ name: `${dir}/segment.json`, data: headerBytes }, { name: `${dir}/seals.json`, data: Buffer.from(JSON.stringify(seals, null, 2) + '\n', 'utf8') })
  for (const p of parts) entries.push({ name: `${dir}/${p.path}`, data: p.data })
  return writeZip(entries)
}

function sealsOf(segment) {
  const list = readJson(segment.files.get('seals.json')?.toString('utf8') ?? '{}').value?.signatures
  return Array.isArray(list) ? list : []
}

/**
 * Verifies a file. The report separates three questions:
 *   integrity  was anything altered since each segment was sealed?
 *   chain      do the segments follow each other, and is the beginning there?
 *   origin     who sealed each segment, as far as the verifier's trust store knows?
 * Findings of level "error" make the file invalid; "warning" is for what a
 * person must know before relying on it.
 */
export function verify(bytes, { trust = { keys: [] } } = {}) {
  const findings = []
  const note = (level, code, message, segment) => findings.push({ level, code, message, ...(segment ? { segment } : {}) })
  let file
  try {
    file = open(bytes)
  } catch (err) {
    if (!(err instanceof ContainerError)) throw err
    return { valid: false, findings: [{ level: 'error', code: 'container', message: err.message }], segments: [] }
  }
  const segments = []
  let before = null
  for (const s of file.segments) {
    const { bytes: headerBytes, header, problems } = readHeader(s)
    const out = { sequence: s.sequence, seals: [], parts: [] }
    segments.push(out)
    if (!header || problems.length) {
      for (const p of problems) note('error', 'header', p, s.sequence)
      before = null
      continue
    }
    Object.assign(out, { id: header.id, createdAt: header.createdAt, issuer: header.issuer, format: header.format })
    if (header.format.id !== file.format) note('error', 'format', `the segment is of format "${header.format.id}" in a .${file.format} file`, s.sequence)

    // the parts: every file of the segment is listed, every listed file is intact or withheld
    const listed = new Set(header.parts.map((p) => p.path))
    for (const name of s.files.keys()) if (name !== 'segment.json' && name !== 'seals.json' && !listed.has(name)) note('error', 'unlisted-file', `${name} is in the segment but not in its header: nobody sealed it`, s.sequence)
    for (const p of header.parts) {
      const data = s.files.get(p.path)
      const state = !data ? 'withheld' : data.length === p.size && digest(data, p.digest.split(':')[0]) === p.digest ? 'intact' : 'altered'
      out.parts.push({ path: p.path, type: p.type, state })
      if (state === 'altered') note('error', 'part-altered', `${p.path} is not what was sealed`, s.sequence)
    }

    // the seals: at least one, each checked against the bytes of the header
    const entries = sealsOf(s)
    if (entries.length === 0) note('error', 'no-seal', 'the segment bears no seal', s.sequence)
    for (const entry of entries) {
      const info = checkSeal(headerBytes, entry)
      const origin = info.valid ? resolve(info, header, trust) : null
      out.seals.push({ keyId: info.keyId, algorithm: info.algorithm, kind: info.kind, role: info.role, valid: info.valid, ...(info.why ? { why: info.why } : {}), ...(origin ? { origin } : {}) })
      if (!info.valid) note('error', 'seal-invalid', info.why, s.sequence)
      else if (origin.status === 'unknown-key') note('warning', 'origin-unknown', origin.why, s.sequence)
      else if (origin.status !== 'trusted') note('error', `origin-${origin.status}`, origin.why, s.sequence)
      else if (origin.why) note('warning', 'origin-note', origin.why, s.sequence)
    }
    if (!out.seals.some((x) => x.valid && x.kind === 'seal' && x.role === 'issuer')) note('error', 'no-issuer-seal', 'no valid seal of the issuer', s.sequence)

    // the chain
    if (header.previous === null) {
      out.chain = 'first'
      if (s.sequence !== 1) note('error', 'chain', 'a segment that follows nothing must be the first', s.sequence)
    } else if (!before) {
      out.chain = 'previous-missing'
      note('warning', 'chain-incomplete', `the file does not hold segment ${header.previous.sequence}, which this one follows: what came before is not shown`, s.sequence)
    } else if (header.previous.sequence !== before.sequence || header.previous.digest !== digest(before.bytes, header.previous.digest.split(':')[0])) {
      out.chain = 'broken'
      note('error', 'chain', `this segment does not follow segment ${before.sequence} as it is in the file`, s.sequence)
    } else out.chain = 'linked'
    // a segment dated before the one it follows: possible only if a date is wrong, and worth a look
    if (before && Date.parse(header.createdAt) < Date.parse(before.createdAt)) note('warning', 'chain-dates', `this segment is dated before segment ${before.sequence}, which it follows`, s.sequence)
    before = { sequence: s.sequence, bytes: headerBytes, createdAt: header.createdAt }
  }
  const errors = findings.filter((f) => f.level === 'error')
  return {
    format: file.format,
    valid: errors.length === 0,
    integrity: !errors.some((f) => ['container', 'header', 'format', 'unlisted-file', 'part-altered', 'no-seal', 'seal-invalid', 'no-issuer-seal'].includes(f.code)),
    chain: errors.some((f) => f.code === 'chain') ? 'broken' : findings.some((f) => f.code === 'chain-incomplete') ? 'incomplete' : 'complete',
    origin: segments.every((s) => s.seals.some((x) => x.valid && x.origin?.status === 'trusted')) ? 'known' : errors.some((f) => f.code.startsWith('origin-')) ? 'refused' : 'unknown',
    segments,
    findings,
  }
}

/**
 * Withholds parts: the holder of a file may give it without some of its parts
 * (a salary history, a document). The seals stay valid, since they cover the
 * digests of the parts and not the parts; the reader sees which were withheld.
 * `drop` is a list of { sequence, path }. No key is needed.
 */
export function withhold(bytes, drop) {
  const file = open(bytes)
  const entries = [{ name: 'mimetype', data: Buffer.from(file.mediaType, 'ascii') }]
  for (const s of file.segments) {
    for (const [name, data] of s.files) {
      const dropped = drop.some((d) => d.sequence === s.sequence && d.path === name)
      if (dropped && (name === 'segment.json' || name === 'seals.json')) throw new ContainerError('a header or its seals cannot be withheld')
      if (!dropped) entries.push({ name: `${s.dir}/${name}`, data })
    }
  }
  return writeZip(entries)
}
