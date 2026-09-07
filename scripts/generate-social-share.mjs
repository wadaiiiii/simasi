import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const source = path.join(root, 'assets', 'social', 'share-simasi.svg')
const publicDir = path.join(root, 'public')
const output = path.join(publicDir, 'share-simasi-20260908.png')

await fs.mkdir(publicDir, { recursive: true })
await sharp(source, { density: 144 })
  .resize(1200, 630, { fit: 'fill' })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(output)

console.log(`Generated ${path.relative(root, output)}`)
