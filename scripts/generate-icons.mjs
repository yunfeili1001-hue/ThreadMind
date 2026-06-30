import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return ~c >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const chunk = Buffer.concat([
    Buffer.from(type),
    data,
  ])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])))
  return Buffer.concat([len, chunk, crc])
}

function createPng(size) {
  const row = Buffer.alloc(1 + size * 4)
  for (let x = 0; x < size; x++) {
    const i = 1 + x * 4
    row[i] = 17
    row[i + 1] = 17
    row[i + 2] = 17
    row[i + 3] = 255
  }
  const raw = Buffer.concat(Array(size).fill(row))
  const compressed = zlib.deflateSync(raw)

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), createPng(size))
  console.log(`wrote icon${size}.png`)
}
