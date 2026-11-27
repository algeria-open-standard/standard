// The ZIP container of an AOS file, read and written strictly.
//
// An AOS file is a ZIP archive, and an archive received from someone else is
// hostile until proved otherwise. This reader accepts only what the standard
// allows (AOS Core, "Conteneur") and refuses everything else: paths that leave
// the archive, two entries of one name, encryption, ZIP64, an entry that
// inflates beyond the limits. It never writes to disk.
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib'

export const LIMITS = { entries: 10_000, entrySize: 64 * 1024 * 1024, totalSize: 512 * 1024 * 1024 }

export class ContainerError extends Error {}

/** A path inside the archive: relative, forward slashes, no empty, "." or ".." segment. */
export function safePath(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 512) return false
  if (name.includes('\\') || name.includes('\0') || name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return false
  return name.split('/').every((s) => s !== '' && s !== '.' && s !== '..')
}

/**
 * Writes an archive. `entries` is a list of { name, data (Buffer) } in the
 * order they must appear. The entry "mimetype" is stored uncompressed, so that
 * the kind of file can be read at a fixed place. Dates are fixed: the same
 * content gives the same bytes.
 */
export function writeZip(entries) {
  const chunks = []
  const central = []
  let offset = 0
  const seen = new Set()
  for (const { name, data } of entries) {
    if (!safePath(name)) throw new ContainerError(`unsafe path: ${name}`)
    if (seen.has(name)) throw new ContainerError(`duplicate entry: ${name}`)
    seen.add(name)
    const nameBytes = Buffer.from(name, 'utf8')
    const store = name === 'mimetype' || data.length === 0
    const body = store ? data : deflateRawSync(data, { level: 9 })
    const head = Buffer.alloc(30)
    head.writeUInt32LE(0x04034b50, 0)
    head.writeUInt16LE(20, 4) // version needed
    head.writeUInt16LE(0x0800, 6) // names are UTF-8
    head.writeUInt16LE(store ? 0 : 8, 8)
    head.writeUInt16LE(0, 10) // time
    head.writeUInt16LE(0x0021, 12) // date: 1980-01-01
    head.writeUInt32LE(crc32(data), 14)
    head.writeUInt32LE(body.length, 18)
    head.writeUInt32LE(data.length, 22)
    head.writeUInt16LE(nameBytes.length, 26)
    head.writeUInt16LE(0, 28)
    chunks.push(head, nameBytes, body)
    const dir = Buffer.alloc(46)
    dir.writeUInt32LE(0x02014b50, 0)
    dir.writeUInt16LE(20, 4)
    head.copy(dir, 6, 4, 30) // version needed … extra length
    dir.writeUInt32LE(offset, 42)
    central.push(dir, nameBytes)
    offset += 30 + nameBytes.length + body.length
  }
  const dirSize = central.reduce((n, b) => n + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(dirSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...chunks, ...central, end])
}

/** Reads an archive into a Map of name → Buffer, in the order of the archive, or throws a ContainerError. */
export function readZip(bytes, limits = LIMITS) {
  const fail = (why) => {
    throw new ContainerError(why)
  }
  if (bytes.length < 22) fail('not a ZIP archive')
  // the end record is the last thing in the file: a comment after it is not allowed
  const end = bytes.length - 22
  if (bytes.readUInt32LE(end) !== 0x06054b50) fail('no end record at the end of the file (a comment or trailing data is not allowed)')
  if (bytes.readUInt16LE(end + 4) !== 0 || bytes.readUInt16LE(end + 6) !== 0) fail('archives on several disks are not allowed')
  const count = bytes.readUInt16LE(end + 10)
  const dirSize = bytes.readUInt32LE(end + 12)
  const dirAt = bytes.readUInt32LE(end + 16)
  if (count === 0xffff || dirAt === 0xffffffff) fail('ZIP64 is not allowed')
  if (count > limits.entries) fail(`too many entries (${count})`)
  if (dirAt + dirSize !== end) fail('the central directory does not end at the end record')

  const files = new Map()
  let at = dirAt
  let total = 0
  let expected = 0 // entries must follow each other without gap: nothing is hidden between them
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || bytes.readUInt32LE(at) !== 0x02014b50) fail('damaged central directory')
    const flags = bytes.readUInt16LE(at + 8)
    const method = bytes.readUInt16LE(at + 10)
    const crc = bytes.readUInt32LE(at + 16)
    const packed = bytes.readUInt32LE(at + 20)
    const size = bytes.readUInt32LE(at + 24)
    const nameLen = bytes.readUInt16LE(at + 28)
    const extraLen = bytes.readUInt16LE(at + 30)
    const commentLen = bytes.readUInt16LE(at + 32)
    const local = bytes.readUInt32LE(at + 42)
    const name = bytes.subarray(at + 46, at + 46 + nameLen).toString('utf8')
    at += 46 + nameLen + extraLen + commentLen
    if (flags & 0x0001) fail(`${name}: encrypted entries are not allowed`)
    if (flags & 0x0008) fail(`${name}: entries with a data descriptor are not allowed`)
    if (method !== 0 && method !== 8) fail(`${name}: compression method ${method} is not allowed`)
    // the kind of file must be readable at a fixed place, without unpacking anything
    if (name === 'mimetype' && (method !== 0 || extraLen !== 0)) fail('mimetype must be stored uncompressed, without extra field')
    if (!safePath(name)) fail(`unsafe path: ${JSON.stringify(name)}`)
    if (files.has(name)) fail(`duplicate entry: ${name}`)
    if (size > limits.entrySize) fail(`${name}: larger than ${limits.entrySize} bytes`)
    total += size
    if (total > limits.totalSize) fail(`the archive inflates beyond ${limits.totalSize} bytes`)
    if (local !== expected) fail(`${name}: entries must follow each other without gap`)
    if (local + 30 > dirAt || bytes.readUInt32LE(local) !== 0x04034b50) fail(`${name}: damaged entry`)
    const localName = bytes.subarray(local + 30, local + 30 + bytes.readUInt16LE(local + 26)).toString('utf8')
    if (localName !== name) fail(`${name}: named ${JSON.stringify(localName)} in its own header`)
    if (bytes.readUInt16LE(local + 8) !== method || bytes.readUInt32LE(local + 18) !== packed || bytes.readUInt32LE(local + 22) !== size) fail(`${name}: its two headers disagree`)
    if (name === 'mimetype' && bytes.readUInt16LE(local + 28) !== 0) fail('mimetype must be stored uncompressed, without extra field')
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
    if (start + packed > dirAt) fail(`${name}: runs past the central directory`)
    expected = start + packed
    const body = bytes.subarray(start, start + packed)
    let data
    try {
      data = method === 0 ? Buffer.from(body) : inflateRawSync(body, { maxOutputLength: size + 1 })
    } catch {
      fail(`${name}: cannot be inflated`)
    }
    if (data.length !== size) fail(`${name}: is ${data.length} bytes, its header says ${size}`)
    if (crc32(data) !== crc) fail(`${name}: checksum mismatch`)
    files.set(name, data)
  }
  if (expected !== dirAt) fail('data between the last entry and the central directory')
  return files
}
