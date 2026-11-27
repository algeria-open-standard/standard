// JSON as the standard reads it: member names are exact, and an object never
// holds the same name twice (spec/core.md, 3.1). The second rule matters for
// security: with a repeated member, one reader would show the first value and
// another the last, both under the same valid seal.

/**
 * The name repeated inside one object of a JSON text, or null when there is
 * none. The text must already be valid JSON.
 */
export function repeatedMember(text) {
  const stack = [] // one Set of names for each object being read, null for an array
  let expectName = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      let j = i + 1
      while (text[j] !== '"') j += text[j] === '\\' ? 2 : 1
      if (expectName) {
        const name = JSON.parse(text.slice(i, j + 1))
        const names = stack.at(-1)
        if (names.has(name)) return name
        names.add(name)
        expectName = false
      }
      i = j
    } else if (c === '{') {
      stack.push(new Set())
      expectName = true
    } else if (c === '[') {
      stack.push(null)
      expectName = false
    } else if (c === '}' || c === ']') {
      stack.pop()
      expectName = false
    } else if (c === ',') expectName = stack.at(-1) !== null
  }
  return null
}

/** Parses a JSON text as the standard reads it. Returns { value } or { problem }. */
export function readJson(text) {
  let value
  try {
    value = JSON.parse(text)
  } catch {
    return { problem: 'not JSON' }
  }
  const twice = repeatedMember(text)
  return twice === null ? { value } : { problem: `the member ${JSON.stringify(twice)} appears twice in one object` }
}

/** A date and time as the standard writes it: RFC 3339, in UTC, ending with Z. */
export const UTC = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?Z$/
