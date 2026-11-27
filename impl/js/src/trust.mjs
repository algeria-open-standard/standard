// Who holds a key. Cryptography says that a segment was sealed by the holder
// of a key; it does not say who that holder is. That comes from outside the
// file: a key the verifier was given directly, a key published by its holder
// on its own domain, a certificate of an authorised provider, a registry.
//
// This reference implementation knows one source: a trust store, a file the
// verifier builds and is responsible for. How a key got into it (`source`) is
// recorded and reported, never judged here. See spec/trust.md.

/** Trust levels, from the weakest to the strongest evidence of origin. */
export const LEVELS = {
  none: 'T0', // integrity only: the key is not known to the verifier
  direct: 'T1', // the key was given to the verifier by its holder
  domain: 'T2', // the key is published by its holder on a domain it controls
  registry: 'T3', // the key is recorded in a registry the verifier relies on
  certificate: 'T4', // the key is certified by an authorised trust service provider
}

// two identifiers are the same number when their schemes are equal and their values are, spaces and case set aside
const bare = (v) => String(v).replace(/\s+/g, '').toUpperCase()
const same = (a, b) => a.scheme === b.scheme && bare(a.value) === bare(b.value)

/**
 * Looks a sealing key up in the trust store and checks it against the issuer
 * the segment names and the date the segment gives.
 * Returns { level, status, holder?, source?, why? } with status one of:
 *   unknown-key       the store does not hold the key: integrity only
 *   trusted           the key is held by the issuer named, and was valid at the date given
 *   holder-mismatch   the key is known, but belongs to another party than the issuer named
 *   outside-validity  the date of the segment is outside the validity of the key
 *   revoked           the key was revoked before the date of the segment
 */
export function resolve(sealInfo, header, trust) {
  const entry = (trust?.keys ?? []).find((k) => k.kid === sealInfo.keyId)
  if (!entry) return { level: LEVELS.none, status: 'unknown-key', why: 'the verifier does not know this key: the seal proves that the segment was not altered, not who made it' }
  const out = { level: LEVELS[entry.source] ?? LEVELS.direct, source: entry.source ?? 'direct', holder: entry.holder }
  const claimed = header.issuer?.identifiers ?? []
  const known = entry.holder?.identifiers ?? []
  // the issuer named in the segment must be the holder of the key: one identifier in common, none in conflict
  const shared = claimed.filter((c) => known.some((k) => same(c, k)))
  const conflict = claimed.some((c) => known.some((k) => k.scheme === c.scheme && !same(c, k)))
  if (shared.length === 0 || conflict) return { ...out, status: 'holder-mismatch', why: `this key belongs to ${entry.holder?.name ?? 'another party'}, not to the issuer the segment names` }
  // the date is the one the sealer wrote: it is evidence only as far as the sealer is believed (spec/seal.md, "Le temps")
  const at = Date.parse(header.createdAt)
  if (entry.revokedAt && at >= Date.parse(entry.revokedAt)) return { ...out, status: 'revoked', why: `the key was revoked on ${entry.revokedAt}${entry.revocationReason ? ` (${entry.revocationReason})` : ''}` }
  if ((entry.validFrom && at < Date.parse(entry.validFrom)) || (entry.validUntil && at > Date.parse(entry.validUntil))) return { ...out, status: 'outside-validity', why: 'the segment is dated outside the validity of the key' }
  return { ...out, status: 'trusted', ...(entry.revokedAt ? { why: `sealed before the key was revoked on ${entry.revokedAt}: the date of the segment is the sealer's word` } : {}) }
}
