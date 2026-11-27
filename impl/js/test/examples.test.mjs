// The published examples are the test vectors of the standard: any other
// implementation must reach the same verdicts on the same files. This test
// also holds the schemas to the examples, and the examples to the schemas.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

import { open, verify } from '../src/container.mjs'
import { checkHr } from '../src/hr.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (...p) => readFileSync(path.join(root, ...p))
const json = (...p) => JSON.parse(read(...p).toString('utf8'))
const examples = path.join('formats', 'hr', 'examples')
const trust = json(examples, 'trust.json')

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
const schema = (...p) => ajv.compile(json(...p))
const segmentSchema = schema('spec', 'schema', 'segment.schema.json')
const sealsFile = json('spec', 'schema', 'seals.schema.json')
const sealsSchema = ajv.compile(sealsFile)
const protectedSchema = ajv.compile({ ...sealsFile.$defs.protectedHeader, $id: 'urn:aos:spec:0.1:seals:protected' })
const partSchemas = Object.fromEntries(readdirSync(path.join(root, 'formats', 'hr', 'schema')).map((f) => [`hr.${f.replace('.schema.json', '')}`, schema('formats', 'hr', 'schema', f)]))
const fits = (validate, value, what) => assert.ok(validate(value), `${what}: ${JSON.stringify(validate.errors?.[0])}`)

test('the example of 2028 verifies: two companies, one chain, both known to the reader', () => {
  const bytes = read(examples, 'amine-benali-2028.hr')
  const report = verify(bytes, { trust })
  assert.deepEqual([report.valid, report.integrity, report.chain, report.origin, report.findings.length], [true, true, 'complete', 'known', 0])
  assert.deepEqual(report.segments.map((s) => s.issuer.name), ['SARL Atlas Conseil', 'EURL Numidia Tech'])
  assert.deepEqual(checkHr(bytes), [])
})

test('the example of 2026 is, byte for byte, the first segment of the example of 2028', () => {
  const [before] = open(read(examples, 'amine-benali-2026.hr')).segments
  const [kept] = open(read(examples, 'amine-benali-2028.hr')).segments
  assert.deepEqual([...kept.files.keys()], [...before.files.keys()])
  for (const [name, data] of before.files) assert.ok(kept.files.get(name).equals(data), name)
})

test('the example given without salaries verifies, and says what was withheld', () => {
  const report = verify(read(examples, 'amine-benali-2028-sans-salaires.hr'), { trust })
  assert.equal(report.valid, true)
  assert.deepEqual(report.segments.flatMap((s) => s.parts.filter((p) => p.state === 'withheld').map((p) => p.path)), ['parts/payroll/2026.json', 'parts/payroll/2028.json'])
})

test('without the keys of the two companies, the reader learns integrity and nothing of origin', () => {
  const report = verify(read(examples, 'amine-benali-2028.hr'))
  assert.deepEqual([report.valid, report.integrity, report.origin], [true, true, 'unknown'])
  assert.deepEqual(report.findings.map((f) => f.code), ['origin-unknown', 'origin-unknown'])
})

test('every header, every seal and every part of the examples fits its schema', () => {
  for (const s of open(read(examples, 'amine-benali-2028.hr')).segments) {
    const header = JSON.parse(s.files.get('segment.json'))
    fits(segmentSchema, header, `segment ${s.sequence}`)
    const seals = JSON.parse(s.files.get('seals.json'))
    fits(sealsSchema, seals, `seals ${s.sequence}`)
    for (const entry of seals.signatures) fits(protectedSchema, JSON.parse(Buffer.from(entry.protected, 'base64url')), `protected header ${s.sequence}`)
    for (const part of header.parts) {
      if (part.type === 'file') continue
      assert.ok(partSchemas[part.type], `no schema for ${part.type}`)
      const value = JSON.parse(s.files.get(part.path))
      assert.equal(value.type, part.type)
      fits(partSchemas[part.type], value, `${s.sequence}/${part.path}`)
    }
  }
})

test('every code of the examples is in the vocabulary, and the registry points at what exists', () => {
  const codes = new Set(json('formats', 'hr', 'vocab', 'pay-elements.json').elements.map((e) => e.code))
  for (const s of open(read(examples, 'amine-benali-2028.hr')).segments) {
    for (const [name, data] of s.files) {
      if (!name.startsWith('parts/payroll/')) continue
      for (const slip of JSON.parse(data).payslips) for (const line of slip.lines) assert.ok(codes.has(line.code) || line.code.startsWith('x-'), line.code)
    }
  }
  const schemes = new Set(json('registry', 'identifier-schemes.json').schemes.map((x) => x.scheme))
  for (const key of trust.keys) for (const id of key.holder.identifiers) assert.ok(schemes.has(id.scheme), id.scheme)
  for (const format of json('registry', 'formats.json').formats) assert.ok(read(format.path, 'README.md').length > 0)
})
