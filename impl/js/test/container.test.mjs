import assert from 'node:assert/strict'
import { test } from 'node:test'

import { append, open, verify, withhold } from '../src/container.mjs'
import { checkHr, HR } from '../src/hr.mjs'
import { checkProof, checkSeal, digest, generateKey, keyId, prove, publicJwk, seal } from '../src/seal.mjs'
import { readZip, writeZip } from '../src/zip.mjs'

const json = (v) => Buffer.from(JSON.stringify(v), 'utf8')
const A = { name: 'SARL Alpha', country: 'DZ', identifiers: [{ scheme: 'dz:nif', value: '000000000000001' }] }
const B = { name: 'EURL Beta', country: 'DZ', identifiers: [{ scheme: 'dz:nif', value: '000000000000002' }] }
const keyA = generateKey()
const keyB = generateKey('ES256')
const person = (nin = '1', name = 'Benali') => ({ type: 'hr.identity', version: '0.1', person: { familyName: name, givenNames: 'Amine', birth: { date: '1994-05-17' }, identifiers: [{ scheme: 'dz:nin', value: nin }] } })
const job = (employer) => ({ type: 'hr.employment', version: '0.1', employer: { name: employer.name, identifiers: employer.identifiers }, hiredOn: '2023-02-01', leftOn: null, contracts: [{ kind: 'cdi', from: '2023-02-01', to: null, position: 'Comptable' }] })
const parts = (employer, identity = person()) => [
  { path: 'parts/identity.json', type: 'hr.identity', mediaType: 'application/json', data: json(identity) },
  { path: 'parts/employment.json', type: 'hr.employment', mediaType: 'application/json', data: json(job(employer)) },
  { path: 'parts/payroll/2026.json', type: 'hr.payroll', mediaType: 'application/json', data: json({ type: 'hr.payroll', version: '0.1', year: 2026, currency: 'DZD', payslips: [] }) },
]
const trust = {
  keys: [
    { kid: keyId(keyA), holder: A, source: 'direct' },
    { kid: keyId(keyB), holder: B, source: 'registry' },
  ],
}
const first = () => append(null, { format: HR, issuer: A, parts: parts(A), keys: [{ jwk: keyA, kind: 'seal', role: 'issuer' }], createdAt: '2026-06-30T15:00:00Z' })
const both = (start = first()) => append(start, { format: HR, issuer: B, parts: parts(B), keys: [{ jwk: keyB, kind: 'seal', role: 'issuer' }], createdAt: '2028-09-30T10:00:00Z', trust })

/** The same archive with one entry changed, added or removed: what someone who holds the file can do to it. */
function tamper(bytes, change) {
  const files = readZip(bytes)
  change(files)
  return writeZip([...files].map(([name, data]) => ({ name, data })))
}
const codes = (report) => report.findings.filter((f) => f.level === 'error').map((f) => f.code)

test('a file sealed by one company, then by the next, verifies: integrity, chain and origin', () => {
  const report = verify(both(), { trust })
  assert.deepEqual([report.valid, report.integrity, report.chain, report.origin], [true, true, 'complete', 'known'])
  assert.deepEqual(report.segments.map((s) => [s.sequence, s.issuer.name, s.chain, s.seals[0].algorithm, s.seals[0].origin.level]), [
    [1, 'SARL Alpha', 'first', 'EdDSA', 'T1'],
    [2, 'EURL Beta', 'linked', 'ES256', 'T3'],
  ])
  assert.deepEqual(checkHr(both()), [])
})

test('the second company leaves the first segment byte for byte as it received it, and records what it checked', () => {
  const start = first()
  const one = open(start).segments[0]
  const [kept, added] = open(both(start)).segments
  for (const [name, data] of one.files) assert.ok(kept.files.get(name).equals(data), name)
  const header = JSON.parse(added.files.get('segment.json'))
  assert.equal(header.previous.sequence, 1)
  assert.deepEqual(header.previous.seals, [{ keyId: keyId(keyA), cryptographic: 'valid', trust: 'trusted' }])
})

test('any change to a part, however small, is found', () => {
  const altered = tamper(both(), (files) => files.set('segments/0001/parts/employment.json', json({ ...job(A), hiredOn: '2019-02-01' })))
  const report = verify(altered, { trust })
  assert.equal(report.valid, false)
  assert.deepEqual(codes(report), ['part-altered'])
  assert.equal(report.segments[0].parts.find((p) => p.path === 'parts/employment.json').state, 'altered')
  // the other segment is untouched and still vouched for
  assert.equal(report.segments[1].seals[0].valid, true)
})

test('a header rewritten to match an altered part breaks the seal', () => {
  const forged = tamper(first(), (files) => {
    const data = json({ ...job(A), hiredOn: '2019-02-01' })
    files.set('segments/0001/parts/employment.json', data)
    const header = JSON.parse(files.get('segments/0001/segment.json'))
    const entry = header.parts.find((p) => p.path === 'parts/employment.json')
    entry.size = data.length
    entry.digest = digest(data)
    files.set('segments/0001/segment.json', Buffer.from(JSON.stringify(header, null, 2) + '\n'))
  })
  assert.deepEqual(codes(verify(forged, { trust })), ['seal-invalid', 'no-issuer-seal'])
})

test('a forger who re-seals with its own key is told apart: the key is not the issuer’s', () => {
  const thief = generateKey()
  const forged = tamper(first(), (files) => {
    const header = files.get('segments/0001/segment.json')
    files.set('segments/0001/seals.json', json({ signatures: [seal(header, thief)] }))
  })
  // unknown to the verifier: valid cryptography, no origin
  const unknown = verify(forged, { trust })
  assert.deepEqual([unknown.valid, unknown.origin, unknown.findings[0].code], [true, 'unknown', 'origin-unknown'])
  // known to the verifier as someone else's key: refused
  const known = verify(forged, { trust: { keys: [...trust.keys, { kid: keyId(thief), holder: B, source: 'direct' }] } })
  assert.deepEqual([known.valid, known.origin, codes(known)], [false, 'refused', ['origin-holder-mismatch']])
})

test('a file added to a segment after it was sealed is refused', () => {
  const stuffed = tamper(first(), (files) => files.set('segments/0001/parts/sanctions.json', json({ type: 'x-forged', note: 'never sealed' })))
  assert.deepEqual(codes(verify(stuffed, { trust })), ['unlisted-file'])
})

test('the holder may withhold parts: the seals stay valid and the reader sees what was withheld', () => {
  const given = withhold(both(), [{ sequence: 1, path: 'parts/payroll/2026.json' }])
  const report = verify(given, { trust })
  assert.equal(report.valid, true)
  assert.deepEqual(report.segments[0].parts.map((p) => p.state), ['intact', 'intact', 'withheld'])
  assert.throws(() => withhold(both(), [{ sequence: 1, path: 'segment.json' }]), /cannot be withheld/)
})

test('the chain: a segment removed from the start is said, one replaced or reordered is refused', () => {
  // the first employer hidden: the second segment still names what it followed
  const hidden = tamper(both(), (files) => {
    for (const name of [...files.keys()]) if (name.startsWith('segments/0001/')) files.delete(name)
  })
  const report = verify(hidden, { trust })
  assert.deepEqual([report.valid, report.chain, report.segments[0].chain], [true, 'incomplete', 'previous-missing'])

  // the first segment replaced by another one sealed by the same company: the second no longer follows it
  const other = append(null, { format: HR, issuer: A, parts: parts(A), keys: [{ jwk: keyA, kind: 'seal', role: 'issuer' }], createdAt: '2026-07-01T00:00:00Z' })
  const swapped = tamper(both(), (files) => {
    for (const [name, data] of readZip(other)) if (name.startsWith('segments/0001/')) files.set(name, data)
  })
  assert.deepEqual([verify(swapped, { trust }).chain, codes(verify(swapped, { trust }))], ['broken', ['chain']])
})

test('a segment dated before the one it follows is pointed out', () => {
  const early = append(first(), { format: HR, issuer: B, parts: parts(B), keys: [{ jwk: keyB, kind: 'seal', role: 'issuer' }], createdAt: '2025-01-01T00:00:00Z', trust })
  const report = verify(early, { trust })
  assert.deepEqual([report.valid, report.findings.map((f) => f.code)], [true, ['chain-dates']])
})

test('the last segment cut off cannot be seen from the file alone: this limit is known', () => {
  const cut = tamper(both(), (files) => {
    for (const name of [...files.keys()]) if (name.startsWith('segments/0002/')) files.delete(name)
  })
  const report = verify(cut, { trust })
  // the file is the valid file of 2026: nothing in it says that a later employer exists
  assert.deepEqual([report.valid, report.chain, report.segments.length], [true, 'complete', 1])
})

test('a key is trusted for its holder only, within its validity, and not after its revocation', () => {
  const at = (entry) => verify(first(), { trust: { keys: [{ kid: keyId(keyA), holder: A, source: 'direct', ...entry }] } })
  assert.equal(at({ validFrom: '2026-01-01T00:00:00Z', validUntil: '2027-01-01T00:00:00Z' }).origin, 'known')
  assert.deepEqual(codes(at({ validFrom: '2026-07-01T00:00:00Z' })), ['origin-outside-validity'])
  assert.deepEqual(codes(at({ revokedAt: '2026-06-01T00:00:00Z', revocationReason: 'compromised' })), ['origin-revoked'])
  // revoked later: accepted, with a warning that the date is the sealer's word
  const later = at({ revokedAt: '2027-03-01T00:00:00Z' })
  assert.deepEqual([later.valid, later.findings[0].code], [true, 'origin-note'])
  // the key of A on a segment that names B as its issuer
  const lying = append(null, { format: HR, issuer: B, parts: parts(B), keys: [{ jwk: keyA, kind: 'seal', role: 'issuer' }] })
  assert.deepEqual(codes(verify(lying, { trust })), ['origin-holder-mismatch'])
})

test('a seal names its algorithm and its key, and neither can be swapped', () => {
  const payload = Buffer.from('{"a":1}')
  const good = seal(payload, keyA)
  assert.equal(checkSeal(payload, good).valid, true)
  assert.equal(checkSeal(Buffer.from('{"a":2}'), good).valid, false)
  const header = (change) => ({ ...good, protected: Buffer.from(JSON.stringify(change(JSON.parse(Buffer.from(good.protected, 'base64url'))))).toString('base64url') })
  assert.match(checkSeal(payload, header((h) => ({ ...h, alg: 'none' }))).why, /not allowed/)
  assert.match(checkSeal(payload, header((h) => ({ ...h, alg: 'ES256' }))).why, /not the one of the key/)
  assert.match(checkSeal(payload, header((h) => ({ ...h, jwk: publicJwk(keyB) }))).why, /not the one of the key|thumbprint/)
  assert.match(checkSeal(payload, header((h) => ({ ...h, jwk: keyA }))).why, /only the public key/)
  assert.match(checkSeal(payload, header((h) => ({ ...h, typ: 'JWT' }))).why, /is not aos-seal\+jws/)
  // an unchanged header with a changed signature
  assert.equal(checkSeal(payload, { ...good, signature: seal(Buffer.from('x'), keyA).signature }).valid, false)
})

test('a proof of possession answers one challenge, with one key, and nothing else', () => {
  const challenge = 'aos-directory-proof:v1:annuaire.example:12:' + keyId(keyA) + ':bm9uY2U:2027-01-10T09:30:00Z'
  for (const key of [keyA, keyB]) {
    const c = challenge.replace(keyId(keyA), keyId(key))
    const proof = prove(c, key)
    assert.equal(proof.split('.').length, 3)
    assert.deepEqual(checkProof(proof, publicJwk(key), c), { valid: true })
    assert.match(checkProof(proof, publicJwk(key), c + 'x').why, /not over this challenge/)
  }
  // the proof of another key, a seal passed off as a proof, a signature changed
  assert.match(checkProof(prove(challenge, keyB), publicJwk(keyA), challenge).why, /not the one of the deposited key/)
  assert.match(checkProof(prove(challenge, generateKey()), publicJwk(keyA), challenge).why, /names another key/)
  const s = seal(Buffer.from(challenge), keyA)
  assert.match(checkProof(s.protected + '.' + Buffer.from(challenge).toString('base64url') + '.' + s.signature, publicJwk(keyA), challenge).why, /is not aos-proof\+jws/)
  const proof = prove(challenge, keyA)
  assert.equal(checkProof(proof.slice(0, -4) + 'AAAA', publicJwk(keyA), challenge).valid, false)
})

test('a .hr file is about one person: a segment about someone else is refused', () => {
  const mixed = append(first(), { format: HR, issuer: B, parts: parts(B, person('2', 'Autre')), keys: [{ jwk: keyB, kind: 'seal', role: 'issuer' }], trust })
  assert.deepEqual(checkHr(mixed).map((f) => f.code), ['hr-subject'])
  const bare = append(null, { format: HR, issuer: A, parts: parts(A).slice(0, 1), keys: [{ jwk: keyA, kind: 'seal', role: 'issuer' }] })
  assert.deepEqual(checkHr(bare).map((f) => f.code), ['hr-part-missing'])
})
