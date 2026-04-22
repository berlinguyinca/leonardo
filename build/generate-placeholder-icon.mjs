// Generates build/icon.png as a 1024×1024 solid-color placeholder.
// Pure Node (zlib + Buffer), no dependencies. Replace icon.png with
// real branded artwork before public release.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const SIZE = 1024
const BG = [0x1a, 0x1a, 0x2e] // matches app backgroundColor
const FG = [0xe8, 0xe8, 0xf0] // light gray "L"

function crc32(buf) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = -1
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

// Draw a chunky block-letter "L" centered on the canvas.
// Vertical bar: x in [280, 430], y in [220, 800]
// Horizontal foot: x in [280, 744], y in [700, 800]
function isForeground(x, y) {
  const inVertical = x >= 280 && x < 430 && y >= 220 && y < 800
  const inFoot = x >= 280 && x < 744 && y >= 700 && y < 800
  return inVertical || inFoot
}

const row = Buffer.alloc(1 + SIZE * 3)
const rows = []
for (let y = 0; y < SIZE; y++) {
  row.fill(0)
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = isForeground(x, y) ? FG : BG
    row[1 + x * 3 + 0] = r
    row[1 + x * 3 + 1] = g
    row[1 + x * 3 + 2] = b
  }
  rows.push(Buffer.from(row))
}
const raw = Buffer.concat(rows)
const idat = deflateSync(raw, { level: 9 })

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 2 // RGB
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
])

const outPath = new URL('./icon.png', import.meta.url).pathname
writeFileSync(outPath, png)
console.log(`Wrote ${outPath} (${png.length} bytes)`)
