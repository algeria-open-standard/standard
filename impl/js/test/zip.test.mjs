import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crc32 } from 'node:zlib'

import { open } from '../src/container.mjs'
import { ContainerError, readZip, safePath, writeZip } from '../src/zip.mjs'

const entry = (name, text) => ({ name, data: Buffer.from(text) })
const good = () => writeZip([entry('mimetype', 'application/vnd.aos.hr+zip'), entry('segments/0001/segment.json', '{}'.repeat(400))])

/** A raw archive written by hand, to give the reader what the writer refuses to make. */
function raw(files, { flags = 0x0800, method = 0, comment = '' } = {}) {
  const chunks = []
  const central = []
  let offset = 0
  for (const [name, data] of files) {
    const n = Buffer.from(name)
    const head = Buffer.alloc(30)
    head.writeUInt32LE(0x04034b50, 0)
    head.writeUInt16LE(20, 4)
    head.writeUInt16LE(flags, 6)
    head.writeUInt16LE(method, 8)
    head.writeUInt32LE(crc32(data), 14)
    head.writeUInt32LE(data.length, 18)
    head.writeUInt32LE(data.length, 22)
    head.writeUInt16LE(n.length, 26)
    chunks.push(head, n, data)
    const dir = Buffer.alloc(46)
    dir.writeUInt32LE(0x02014b50, 0)
    head.copy(dir, 6, 4, 30)
    dir.writeUInt32LE(offset, 42)
    central.push(dir, n)
    offset += 30 + n.length + data.length
  }
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(central.reduce((s, b) => s + b.length, 0), 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(Buffer.byteLength(comment), 20)
  return Buffer.concat([...chunks, ...central, end, Buffer.from(comment)])
}

test('what is written is read back, and the same content gives the same bytes', () => {
  const files = readZip(good())
  assert.deepEqual([...files.keys()], ['mimetype', 'segments/0001/segment.json'])
  assert.equal(files.get('segments/0001/segment.json').length, 800)
  assert.ok(good().equals(good()))
  // the kind of file can be read at a fixed place, without unpacking anything
  assert.equal(good().subarray(30, 38).toString(), 'mimetype')
  assert.equal(good().subarray(38, 64).toString(), 'application/vnd.aos.hr+zip')
})

test('paths that leave the archive are refused', () => {
  for (const name of ['../etc/passwd', '/abs', 'a/../../b', 'a\\b', 'C:/x', 'a//b', './a', 'a/.', '']) assert.equal(safePath(name), false, name)
  assert.equal(safePath('segments/0001/parts/payroll/2026.json'), true)
  assert.throws(() => readZip(raw([['../outside.txt', Buffer.from('x')]])), /unsafe path/)
  assert.throws(() => writeZip([entry('../x', 'y')]), /unsafe path/)
})

test('two entries of one name are refused: a reader and a checker would not see the same file', () => {
  assert.throws(() => readZip(raw([['a.json', Buffer.from('1')], ['a.json', Buffer.from('2')]])), /duplicate entry/)
})

test('what the standard does not allow in the container is refused', () => {
  assert.throws(() => readZip(raw([['a', Buffer.from('x')]], { flags: 0x0801 })), /encrypted/)
  assert.throws(() => readZip(raw([['a', Buffer.from('x')]], { flags: 0x0808 })), /data descriptor/)
  assert.throws(() => readZip(raw([['a', Buffer.from('x')]], { method: 12 })), /compression method 12/)
  assert.throws(() => readZip(raw([['a', Buffer.from('x')]], { comment: 'hidden' })), /end record/)
  assert.throws(() => readZip(Buffer.from('not a zip')), ContainerError)
})

test('an entry that lies about its size, or does not match its checksum, is refused', () => {
  const bytes = good()
  const flipped = Buffer.from(bytes)
  flipped[bytes.indexOf('application')] ^= 1
  assert.throws(() => readZip(flipped), /checksum mismatch/)
  assert.throws(() => readZip(good(), { entries: 10, entrySize: 100, totalSize: 1000 }), /larger than 100 bytes/)
  assert.throws(() => readZip(good(), { entries: 1, entrySize: 1e6, totalSize: 1e6 }), /too many entries/)
})

test('a file that is not an AOS file, or holds something outside its segments, is refused', () => {
  assert.throws(() => open(writeZip([entry('segments/0001/segment.json', '{}'), entry('mimetype', 'application/vnd.aos.hr+zip')])), /first entry must be "mimetype"/)
  assert.throws(() => open(writeZip([entry('mimetype', 'application/zip'), entry('segments/0001/segment.json', '{}')])), /not an AOS file/)
  assert.throws(() => open(writeZip([entry('mimetype', 'application/vnd.aos.hr+zip'), entry('README.txt', 'hello')])), /unexpected entry/)
  assert.throws(() => open(writeZip([entry('mimetype', 'application/vnd.aos.hr+zip')])), /no segment/)
})
