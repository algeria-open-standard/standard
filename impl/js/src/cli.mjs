#!/usr/bin/env node
// The reference tool of the Algeria Open Standard.
//
//   aos keygen --out key.json [--alg EdDSA|ES256]
//       makes a key pair on this machine. key.json holds the private key and
//       must never leave its holder; key.pub.json is what to publish.
//   aos seal --dir <folder> --issuer issuer.json --key key.json --out file.hr
//            [--onto earlier.hr] [--trust trust.json] [--format hr] [--profile employee-file]
//       seals the parts/ and files/ of a folder as a new segment, after the
//       segments of an earlier file when one is given.
//   aos prove --key key.json --challenge "<challenge>"
//       answers the challenge of a key directory: proves that you hold the
//       private key of the public key you deposited. Prints the proof to paste.
//   aos verify file.hr [--trust trust.json] [--json]
//   aos withhold file.hr --drop 1:parts/payroll/2025.json [--drop …] --out public.hr
//       gives a copy without some parts; the seals stay valid.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { append, verify, withhold } from './container.mjs'
import { checkHr, HR } from './hr.mjs'
import { generateKey, keyId, prove, publicJwk } from './seal.mjs'

function options(argv) {
  const opts = { _: [], drop: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) opts._.push(a)
    else if (a === '--drop') opts.drop.push(argv[++i])
    else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts[a.slice(2)] = argv[++i]
    else opts[a.slice(2)] = true
  }
  return opts
}
const json = (file) => JSON.parse(readFileSync(file, 'utf8'))
const MEDIA = { '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain' }

/** The parts of a folder: parts/**.json carry their own type; files/** are attached documents. */
export function partsOf(dir) {
  const out = []
  const walk = (sub) => {
    for (const name of readdirSync(path.join(dir, sub)).sort()) {
      const rel = `${sub}/${name}`
      if (statSync(path.join(dir, rel)).isDirectory()) walk(rel)
      else {
        const data = readFileSync(path.join(dir, rel))
        const type = sub.startsWith('parts') ? JSON.parse(data.toString('utf8')).type : 'file'
        if (typeof type !== 'string') throw new Error(`${rel}: a part must say its "type"`)
        out.push({ path: rel, type, mediaType: MEDIA[path.extname(name).toLowerCase()] ?? 'application/octet-stream', data })
      }
    }
  }
  for (const sub of ['parts', 'files']) if (existsSync(path.join(dir, sub))) walk(sub)
  return out
}

const commands = {
  keygen(opts) {
    if (typeof opts.out !== 'string') throw new Error('--out: where to write the private key')
    if (existsSync(opts.out)) throw new Error(`${opts.out} exists: a key is never overwritten`)
    const key = generateKey(opts.alg === 'ES256' ? 'ES256' : 'EdDSA')
    writeFileSync(opts.out, JSON.stringify(key, null, 2) + '\n', { mode: 0o600 })
    const pub = opts.out.replace(/\.json$/, '') + '.pub.json'
    writeFileSync(pub, JSON.stringify({ kid: keyId(key), jwk: publicJwk(key) }, null, 2) + '\n')
    console.log(`private key: ${opts.out} (keep it; it never leaves you)\npublic key:  ${pub}\nkey id:      ${keyId(key)}`)
  },

  prove(opts) {
    if (typeof opts.key !== 'string' || typeof opts.challenge !== 'string') throw new Error('usage: aos prove --key key.json --challenge "<the challenge the directory gave>"')
    if (!opts.challenge.startsWith('aos-directory-proof:')) throw new Error('this is not a challenge of a key directory: sign nothing else with your seal key')
    console.log(prove(opts.challenge, json(opts.key)))
  },

  seal(opts) {
    for (const need of ['dir', 'issuer', 'key', 'out']) if (typeof opts[need] !== 'string') throw new Error(`--${need} is required`)
    const format = { ...HR, id: opts.format ?? HR.id, ...(opts.profile ? { profile: opts.profile } : {}) }
    const bytes = append(typeof opts.onto === 'string' ? readFileSync(opts.onto) : null, {
      format,
      issuer: json(opts.issuer),
      producer: { name: 'aos-reference', version: '0.1' },
      parts: partsOf(opts.dir),
      keys: [{ jwk: json(opts.key), kind: 'seal', role: 'issuer' }],
      trust: typeof opts.trust === 'string' ? json(opts.trust) : { keys: [] },
    })
    writeFileSync(opts.out, bytes)
    console.log(`${opts.out}: ${bytes.length} bytes`)
  },

  verify(opts) {
    const [file] = opts._.slice(1)
    if (!file) throw new Error('which file?')
    const bytes = readFileSync(file)
    const report = verify(bytes, { trust: typeof opts.trust === 'string' ? json(opts.trust) : { keys: [] } })
    if (report.format === 'hr' && report.segments.length) {
      const more = checkHr(bytes)
      report.findings.push(...more)
      if (more.some((f) => f.level === 'error')) report.valid = false
    }
    if (opts.json) console.log(JSON.stringify(report, null, 2))
    else {
      console.log(`${file}: ${report.valid ? 'valid' : 'NOT VALID'}  (integrity ${report.integrity ? 'intact' : 'broken'}, chain ${report.chain}, origin ${report.origin})`)
      for (const s of report.segments) {
        console.log(`\nsegment ${s.sequence}  ${s.issuer?.name ?? '?'}  ${s.createdAt ?? ''}  [${s.chain ?? '?'}]`)
        for (const x of s.seals) console.log(`  ${x.kind} ${x.valid ? 'valid' : 'INVALID'}  key ${x.keyId}  ${x.origin ? `${x.origin.level} ${x.origin.status}${x.origin.holder ? ` (${x.origin.holder.name}, ${x.origin.source})` : ''}` : ''}`)
        for (const p of s.parts) console.log(`  ${p.state.padEnd(8)} ${p.path}`)
      }
      if (report.findings.length) console.log('')
      for (const f of report.findings) console.log(`${f.level}${f.segment ? ` (segment ${f.segment})` : ''}: ${f.message}`)
    }
    process.exitCode = report.valid ? 0 : 2
  },

  withhold(opts) {
    const [file] = opts._.slice(1)
    if (!file || typeof opts.out !== 'string' || opts.drop.length === 0) throw new Error('usage: aos withhold file --drop <segment>:<path> --out copy')
    const drop = opts.drop.map((d) => {
      const m = /^(\d+):(.+)$/.exec(d)
      if (!m) throw new Error(`--drop ${d}: write it as <segment>:<path>, like 1:parts/payroll/2025.json`)
      return { sequence: Number(m[1]), path: m[2] }
    })
    writeFileSync(opts.out, withhold(readFileSync(file), drop))
    console.log(`${opts.out}: written without ${drop.length} part(s)`)
  },
}

// run as a program, not when imported by a test
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1'))) {
  const opts = options(process.argv.slice(2))
  const command = commands[opts._[0]]
  if (!command) {
    console.log('usage: aos keygen | prove | seal | verify | withhold   (see the head of src/cli.mjs)')
    process.exit(opts._[0] ? 1 : 0)
  }
  try {
    command(opts)
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
}
