// Copies MediaPipe's wasm runtime into public/ so the app never depends on a third-party CDN at runtime.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const target = join(root, 'public/mediapipe/wasm')

if (!existsSync(source)) {
  console.error(`MediaPipe wasm not found at ${source}. Run npm install first.`)
  process.exit(1)
}
// FilesetResolver loads the SIMD build (or the no-SIMD fallback); the ES-module variant is never used
const NEEDED = /^vision_wasm_(nosimd_)?internal\.(js|wasm)$/
rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
for (const file of readdirSync(source).filter((name) => NEEDED.test(name))) {
  cpSync(join(source, file), join(target, file))
}
