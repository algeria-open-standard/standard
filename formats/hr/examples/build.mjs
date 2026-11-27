// Builds the example files of the format .hr, the same bytes every time.
//
//   node formats/hr/examples/build.mjs
//
// The story: Amine Benali works at SARL Atlas Conseil from 2023 to 2026. When
// he leaves, Atlas Conseil gives him his file, sealed. He gives it to his new
// employer, EURL Numidia Tech, which checks the seal and keeps it. In 2028 he
// leaves Numidia Tech, which gives him the file with its own segment added,
// sealed in turn. Everything here is invented: the people, the companies,
// every number.
//
// The keys in keys/ are TEST KEYS, published on purpose so that anyone can
// rebuild and check these files. They protect nothing and must never be used
// for anything real.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { append, withhold } from '../../../impl/js/src/container.mjs'
import { HR } from '../../../impl/js/src/hr.mjs'
import { generateKey, keyId, publicJwk } from '../../../impl/js/src/seal.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8')
const part = (file, value) => ({ path: `parts/${file}`, type: value.type, mediaType: 'application/json', data: json(value) })

function testKey(name) {
  const file = path.join(here, 'keys', `${name}.test-key.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  mkdirSync(path.dirname(file), { recursive: true })
  const key = generateKey()
  writeFileSync(file, JSON.stringify({ warning: 'TEST KEY, published on purpose. Never use it for anything real.', ...key }, null, 2) + '\n')
  return key
}

const atlas = { name: 'SARL Atlas Conseil', country: 'DZ', identifiers: [{ scheme: 'dz:nif', value: '000016000000001' }, { scheme: 'dz:rc', value: '16/00-0000001B23' }] }
const numidia = { name: 'EURL Numidia Tech', country: 'DZ', identifiers: [{ scheme: 'dz:nif', value: '000031000000002' }, { scheme: 'dz:rc', value: '31/00-0000002B26' }] }
const atlasKey = testKey('atlas-conseil')
const numidiaKey = testKey('numidia-tech')

const identity = {
  type: 'hr.identity',
  version: '0.1',
  person: {
    familyName: 'Benali',
    givenNames: 'Amine',
    familyNameAr: 'بن علي',
    givenNamesAr: 'أمين',
    gender: 'M',
    birth: { date: '1994-05-17', place: 'Blida', country: 'DZ' },
    nationality: 'DZ',
    identifiers: [{ scheme: 'dz:nin', value: '000000000000000017' }, { scheme: 'dz:nss', value: '940000000017' }],
  },
}

const slip = (period, base, seniority) => {
  const cents = (n) => (n / 100).toFixed(2)
  const gross = base + seniority + 600000
  const post = base + seniority
  const contribution = Math.round(post * 0.09)
  const tax = 1250000 // an invented figure: this file is an example of the format, not of the tax scale
  return {
    period,
    daysWorked: 22,
    lines: [
      { code: 'base-salary', label: 'Salaire de base', kind: 'earning', amount: cents(base), contributory: true, taxable: true },
      { code: 'seniority-allowance', label: 'Indemnité d’expérience professionnelle', kind: 'earning', amount: cents(seniority), contributory: true, taxable: true },
      { code: 'meal-allowance', label: 'Prime de panier', kind: 'earning', quantity: '22', amount: '6000.00', contributory: false, taxable: true },
      { code: 'social-security-employee', label: 'Retenue sécurité sociale', kind: 'deduction', base: cents(post), rate: '9', amount: cents(contribution) },
      { code: 'income-tax', label: 'IRG', kind: 'deduction', amount: cents(tax) },
    ],
    totals: { gross: cents(gross), contributoryBase: cents(post), employeeContributions: cents(contribution), taxableBase: cents(gross - contribution), incomeTax: cents(tax), net: cents(gross - contribution - tax) },
  }
}

// ---- 2026: Atlas Conseil gives Amine Benali his file ----------------------------------
const certificate = Buffer.from('%PDF-1.4\n% An invented work certificate, standing for a real PDF.\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1')
const first = append(null, {
  format: HR,
  issuer: atlas,
  producer: { name: 'Ojoor', version: '1.0' },
  createdAt: '2026-06-30T15:00:00Z',
  id: 'urn:uuid:5b1c2d3e-0001-4a00-8000-000000000001',
  keys: [{ jwk: atlasKey, kind: 'seal', role: 'issuer' }],
  parts: [
    part('identity.json', identity),
    part('employment.json', {
      type: 'hr.employment',
      version: '0.1',
      employer: { name: atlas.name, legalForm: 'SARL', identifiers: atlas.identifiers, address: 'Alger' },
      employeeNumber: 'AC-0042',
      hiredOn: '2023-02-01',
      leftOn: '2026-06-30',
      contracts: [
        { kind: 'cdd', from: '2023-02-01', to: '2024-01-31', position: 'Comptable', department: 'Finance', workingTime: { regime: 'full-time', weeklyHours: 40 }, trialPeriodDays: 30 },
        { kind: 'cdi', from: '2024-02-01', to: '2026-06-30', position: 'Comptable principal', department: 'Finance', workingTime: { regime: 'full-time', weeklyHours: 40 } },
      ],
      positions: [
        { from: '2023-02-01', to: '2024-12-31', title: 'Comptable', department: 'Finance' },
        { from: '2025-01-01', to: '2026-06-30', title: 'Comptable principal', department: 'Finance' },
      ],
    }),
    part('payroll/2026.json', { type: 'hr.payroll', version: '0.1', year: 2026, currency: 'DZD', payslips: [slip('2026-05', 8500000, 255000), slip('2026-06', 8500000, 255000)] }),
    part('leave.json', { type: 'hr.leave', version: '0.1', asOf: '2026-06-30', annual: { referencePeriod: { from: '2025-07-01', to: '2026-06-30' }, entitledDays: 30, takenDays: 18, balanceDays: 12 } }),
    part('documents.json', { type: 'hr.documents', version: '0.1', documents: [{ kind: 'work-certificate', title: 'Certificat de travail', path: 'files/certificat-de-travail.pdf', issuedOn: '2026-06-30', language: 'fr' }] }),
    { path: 'files/certificat-de-travail.pdf', type: 'file', mediaType: 'application/pdf', data: certificate },
  ],
})

// what Numidia Tech knows of Atlas Conseil: its key, received from it directly
const trustOfNumidia = {
  keys: [{ kid: keyId(atlasKey), jwk: publicJwk(atlasKey), holder: atlas, source: 'direct', validFrom: '2026-01-01T00:00:00Z' }],
}

// ---- 2028: Numidia Tech adds its segment and seals it -----------------------------------
const second = append(first, {
  format: HR,
  issuer: numidia,
  producer: { name: 'Autre logiciel de paie', version: '4.2' },
  createdAt: '2028-09-30T10:30:00Z',
  id: 'urn:uuid:5b1c2d3e-0002-4a00-8000-000000000002',
  keys: [{ jwk: numidiaKey, kind: 'seal', role: 'issuer' }],
  trust: trustOfNumidia,
  parts: [
    part('identity.json', identity),
    part('employment.json', {
      type: 'hr.employment',
      version: '0.1',
      employer: { name: numidia.name, legalForm: 'EURL', identifiers: numidia.identifiers, address: 'Oran' },
      employeeNumber: '2026-118',
      hiredOn: '2026-09-01',
      leftOn: '2028-09-30',
      contracts: [{ kind: 'cdi', from: '2026-09-01', to: '2028-09-30', position: 'Responsable comptable', workingTime: { regime: 'full-time', weeklyHours: 40 } }],
      positions: [{ from: '2026-09-01', to: '2028-09-30', title: 'Responsable comptable' }],
    }),
    part('payroll/2028.json', { type: 'hr.payroll', version: '0.1', year: 2028, currency: 'DZD', payslips: [slip('2028-09', 11000000, 220000)] }),
  ],
})

// what a later reader may know: both keys
const trust = {
  about: 'The trust store of the examples: the keys a verifier was given by their holders. TEST KEYS.',
  keys: [
    ...trustOfNumidia.keys,
    { kid: keyId(numidiaKey), jwk: publicJwk(numidiaKey), holder: numidia, source: 'direct', validFrom: '2026-01-01T00:00:00Z' },
  ],
}

writeFileSync(path.join(here, 'amine-benali-2026.hr'), first)
writeFileSync(path.join(here, 'amine-benali-2028.hr'), second)
// the same file as he may choose to give it: without his salaries at Atlas Conseil
writeFileSync(path.join(here, 'amine-benali-2028-sans-salaires.hr'), withhold(second, [{ sequence: 1, path: 'parts/payroll/2026.json' }, { sequence: 2, path: 'parts/payroll/2028.json' }]))
writeFileSync(path.join(here, 'trust.json'), JSON.stringify(trust, null, 2) + '\n')
console.log(`built: amine-benali-2026.hr (${first.length} bytes), amine-benali-2028.hr (${second.length} bytes), amine-benali-2028-sans-salaires.hr, trust.json`)
