/**
 * Convierte PNG/JPEG de public/ a WebP (resize + quality) y reporta ahorro.
 * Uso: node scripts/optimize-images.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')

const MAX_EDGE = {
  jokers: 900,
  mascot: 1400,
  default: 1200,
}

function maxFor(rel) {
  if (rel.includes(`${path.sep}jokers${path.sep}`)) return MAX_EDGE.jokers
  if (rel.includes(`${path.sep}mascot${path.sep}`)) return MAX_EDGE.mascot
  return MAX_EDGE.default
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(png|jpe?g)$/i.test(name)) out.push(full)
  }
  return out
}

async function convert(file) {
  const rel = path.relative(publicDir, file)
  const outFile = file.replace(/\.(png|jpe?g)$/i, '.webp')
  const before = fs.statSync(file).size
  const max = maxFor(path.sep + rel)

  await sharp(file)
    .rotate()
    .resize({
      width: max,
      height: max,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 80, effort: 5 })
    .toFile(outFile)

  const after = fs.statSync(outFile).size
  return { rel, before, after, outRel: path.relative(publicDir, outFile) }
}

const files = walk(publicDir)
if (!files.length) {
  console.log('No PNG/JPEG under public/')
  process.exit(0)
}

let beforeTotal = 0
let afterTotal = 0
for (const f of files) {
  const r = await convert(f)
  beforeTotal += r.before
  afterTotal += r.after
  const kb = (n) => (n / 1024).toFixed(1)
  console.log(
    `${r.rel} → ${r.outRel}  ${kb(r.before)}KB → ${kb(r.after)}KB  (−${Math.round(
      (1 - r.after / r.before) * 100,
    )}%)`,
  )
}

console.log(
  `\nTotal: ${(beforeTotal / 1024 / 1024).toFixed(1)}MB → ${(afterTotal / 1024 / 1024).toFixed(1)}MB`,
)
