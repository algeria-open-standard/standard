// Seals: detached JWS (RFC 7515) over the exact bytes of a segment header.
//
// A seal is made by a legal person (the company that issues a segment); a
// signature by a natural person uses the same mechanics with kind
// "signature". The private key never leaves its holder: this module is given
// one to seal with, and never generates one on behalf of anyone else.
//
// Algorithms: EdDSA with Ed25519 (RFC 8032, RFC 8037), which every
// implementation must verify, and ES256 (ECDSA P-256 with SHA-256), for keys
// held in hardware and for X.509 certificates.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto'

import { readJson } from './json.mjs'

export const ALGORITHMS = ['EdDSA', 'ES256']
export const SEAL_TYPE = 'aos-seal+jws'
export const PROOF_TYPE = 'aos-proof+jws'

const b64u = (bytes) => Buffer.from(bytes).toString('base64url')
const unb64u = (text) => Buffer.from(text, 'base64url')

/** "sha-256:<hex>" of some bytes: how the standard writes a digest. */
export const digest = (bytes, algorithm = 'sha-256') => `${algorithm}:${createHash(algorithm.replace('-', '')).update(bytes).digest('hex')}`

/** The public half of a JWK: what may be published. */
export function publicJwk(jwk) {
  if (jwk.kty === 'OKP') return { kty: 'OKP', crv: jwk.crv, x: jwk.x }
  if (jwk.kty === 'EC') return { kty: 'EC', crv: jwk.crv, x: jwk.x, y: jwk.y }
  throw new Error(`unsupported key type: ${jwk.kty}`)
}

/** The identifier of a key: its JWK thumbprint (RFC 7638), SHA-256, base64url. The same key has the same identifier everywhere. */
export function keyId(jwk) {
  const p = publicJwk(jwk)
  // RFC 7638: the required members only, in lexicographic order, without whitespace
  const canonical = p.kty === 'OKP' ? `{"crv":"${p.crv}","kty":"OKP","x":"${p.x}"}` : `{"crv":"${p.crv}","kty":"EC","x":"${p.x}","y":"${p.y}"}`
  return b64u(createHash('sha256').update(canonical).digest())
}

function algorithmOf(jwk) {
  if (jwk.kty === 'OKP' && jwk.crv === 'Ed25519') return 'EdDSA'
  if (jwk.kty === 'EC' && jwk.crv === 'P-256') return 'ES256'
  throw new Error(`no allowed algorithm for a ${jwk.kty} ${jwk.crv ?? ''} key`)
}

/** Generates a key pair for the party running this code. Returns the private JWK; `publicJwk` gives what to publish. */
export function generateKey(algorithm = 'EdDSA') {
  const { privateKey } = algorithm === 'ES256' ? generateKeyPairSync('ec', { namedCurve: 'P-256' }) : generateKeyPairSync('ed25519')
  return privateKey.export({ format: 'jwk' })
}

/**
 * Seals a payload (the bytes of segment.json). Returns one entry of the
 * "signatures" list of seals.json. `kind` is "seal" for a legal person and
 * "signature" for a natural person; `role` says in what capacity.
 */
export function seal(payload, privateJwk, { kind = 'seal', role = 'issuer', x5c } = {}) {
  const alg = algorithmOf(privateJwk)
  const jwk = publicJwk(privateJwk)
  const header = { alg, typ: SEAL_TYPE, kid: keyId(jwk), jwk, aosKind: kind, aosRole: role, ...(x5c ? { x5c } : {}) }
  const protectedHeader = b64u(JSON.stringify(header))
  const input = Buffer.from(`${protectedHeader}.${b64u(payload)}`, 'ascii')
  const key = createPrivateKey({ key: privateJwk, format: 'jwk' })
  const signature = alg === 'EdDSA' ? sign(null, input, key) : sign('sha256', input, { key, dsaEncoding: 'ieee-p1363' })
  return { protected: protectedHeader, signature: b64u(signature) }
}

/**
 * Checks one seal against a payload. It answers only what cryptography can
 * answer: this payload was sealed by the holder of this key. Who holds the
 * key is another question (trust.mjs).
 */
export function checkSeal(payload, entry) {
  const read = readJson(unb64u(entry.protected ?? '').toString('utf8'))
  if (read.problem || read.value === null || typeof read.value !== 'object') return { valid: false, why: `the protected header is not readable: ${read.problem ?? 'not an object'}` }
  const header = read.value
  const out = { keyId: header.kid, algorithm: header.alg, kind: header.aosKind, role: header.aosRole, jwk: header.jwk, x5c: header.x5c }
  // a seal says what it is and in what capacity: nothing is assumed for it
  if (header.aosKind !== 'seal' && header.aosKind !== 'signature') return { ...out, valid: false, why: '"aosKind" must be "seal" or "signature"' }
  if (typeof header.aosRole !== 'string' || header.aosRole === '') return { ...out, valid: false, why: '"aosRole" is missing' }
  if (header.typ !== SEAL_TYPE) return { ...out, valid: false, why: `type ${JSON.stringify(header.typ)} is not ${SEAL_TYPE}` }
  // the algorithm is taken from a fixed list and must be the one of the key: never "none", never chosen by the key alone
  if (!ALGORITHMS.includes(header.alg)) return { ...out, valid: false, why: `algorithm ${JSON.stringify(header.alg)} is not allowed` }
  if (header.crit) return { ...out, valid: false, why: 'critical header parameters are not understood' }
  if (!header.jwk || header.jwk.d) return { ...out, valid: false, why: 'the header must carry the public key, and only the public key' }
  let key
  try {
    if (algorithmOf(header.jwk) !== header.alg) return { ...out, valid: false, why: 'the algorithm is not the one of the key' }
    if (keyId(header.jwk) !== header.kid) return { ...out, valid: false, why: 'the key identifier is not the thumbprint of the key' }
    key = createPublicKey({ key: publicJwk(header.jwk), format: 'jwk' })
  } catch (err) {
    return { ...out, valid: false, why: err.message }
  }
  const input = Buffer.from(`${entry.protected}.${b64u(payload)}`, 'ascii')
  const signature = unb64u(entry.signature ?? '')
  const ok = header.alg === 'EdDSA' ? verify(null, input, key, signature) : signature.length === 64 && verify('sha256', input, { key, dsaEncoding: 'ieee-p1363' }, signature)
  return ok ? { ...out, valid: true } : { ...out, valid: false, why: 'the signature does not match the header of the segment' }
}

/**
 * Proves to a key directory that the holder of a public key holds its private
 * key: a JWS in compact serialization over the challenge the directory gave
 * (spec/trust.md, 5.2). The private key signs here and goes nowhere.
 */
export function prove(challenge, privateJwk) {
  const alg = algorithmOf(privateJwk)
  const protectedHeader = b64u(JSON.stringify({ alg, typ: PROOF_TYPE, kid: keyId(privateJwk) }))
  const input = Buffer.from(protectedHeader + '.' + b64u(Buffer.from(challenge, 'utf8')), 'ascii')
  const key = createPrivateKey({ key: privateJwk, format: 'jwk' })
  const signature = alg === 'EdDSA' ? sign(null, input, key) : sign('sha256', input, { key, dsaEncoding: 'ieee-p1363' })
  return input.toString('ascii') + '.' + b64u(signature)
}

/** What a directory checks of a proof: the header, that the payload is its own challenge, then the signature with the deposited key. */
export function checkProof(proof, publicKey, challenge) {
  const parts = String(proof).trim().split('.')
  if (parts.length !== 3) return { valid: false, why: 'a proof has three parts separated by dots' }
  let header
  try {
    header = JSON.parse(unb64u(parts[0]).toString('utf8'))
  } catch {
    return { valid: false, why: 'the header is not JSON' }
  }
  if (header.typ !== PROOF_TYPE) return { valid: false, why: 'type ' + JSON.stringify(header.typ) + ' is not ' + PROOF_TYPE }
  if (!ALGORITHMS.includes(header.alg) || header.alg !== algorithmOf(publicKey)) return { valid: false, why: 'the algorithm is not the one of the deposited key' }
  if (header.kid !== keyId(publicKey)) return { valid: false, why: 'the proof names another key' }
  if (unb64u(parts[1]).toString('utf8') !== challenge) return { valid: false, why: 'the proof is not over this challenge' }
  const input = Buffer.from(parts[0] + '.' + parts[1], 'ascii')
  const key = createPublicKey({ key: publicJwk(publicKey), format: 'jwk' })
  const signature = unb64u(parts[2])
  const ok = header.alg === 'EdDSA' ? verify(null, input, key, signature) : signature.length === 64 && verify('sha256', input, { key, dsaEncoding: 'ieee-p1363' }, signature)
  return ok ? { valid: true } : { valid: false, why: 'the signature does not match' }
}
