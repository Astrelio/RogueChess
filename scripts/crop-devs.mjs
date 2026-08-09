/**
 * Recorta rostros de Contexto/programadores → public/devs/*.webp
 * Regiones afinadas a ojo (selfie vs cuerpo completo vs ilustración).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'Contexto', 'programadores')
const outDir = path.join(root, 'public', 'devs')

fs.mkdirSync(outDir, { recursive: true })

/** left, top, width, height en px de la fuente */
const JOBS = [
  {
    file: 'Anderson Flores lider owner.jpeg',
    out: 'anderson.webp',
    // Presentación: cara arriba-centro
    extract: { left: 240, top: 30, width: 560, height: 560 },
  },
  {
    file: 'astrelio.jpeg',
    out: 'astrelio.webp',
    // Ilustración: rostro en tercio superior
    extract: { left: 70, top: 20, width: 540, height: 540 },
  },
  {
    file: 'Angel Carias.jpeg',
    out: 'angel.webp',
    // Selfie cuadrada: acercar un poco al rostro
    extract: { left: 180, top: 80, width: 1080, height: 1080 },
  },
  {
    file: 'Oscar Ticas.jpeg',
    out: 'ticas.webp',
    // Cuerpo completo: cabeza y hombros
    extract: { left: 250, top: 40, width: 580, height: 580 },
  },
]

for (const job of JOBS) {
  const input = path.join(srcDir, job.file)
  const output = path.join(outDir, job.out)
  const meta = await sharp(input).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  const e = {
    left: Math.max(0, Math.min(job.extract.left, w - 1)),
    top: Math.max(0, Math.min(job.extract.top, h - 1)),
    width: Math.min(job.extract.width, w - Math.max(0, job.extract.left)),
    height: Math.min(job.extract.height, h - Math.max(0, job.extract.top)),
  }
  // Cuadrar: usar el lado menor del extract
  const side = Math.min(e.width, e.height)
  e.width = side
  e.height = side

  await sharp(input)
    .extract(e)
    .resize(512, 512, { fit: 'cover' })
    .webp({ quality: 82, effort: 5 })
    .toFile(output)

  const kb = (fs.statSync(output).size / 1024).toFixed(1)
  console.log(`${job.file} → ${job.out} (${kb}KB) crop=${e.left},${e.top} ${side}x${side}`)
}
