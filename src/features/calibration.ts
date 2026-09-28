import type { Blendshapes, FaceFrame } from '../face/types'
import type { Baseline } from './features'

export const CALIBRATION_MS = 2000
const MIN_SAMPLES = 20

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Median neutral face from calibration frames; null when too few frames had a face. */
export function buildBaseline(frames: readonly FaceFrame[]): Baseline | null {
  const faces = frames.filter((f): f is Extract<FaceFrame, { present: true }> => f.present)
  if (faces.length < MIN_SAMPLES) return null

  const names = Object.keys(faces[0].blendshapes)
  const blendshapes: Blendshapes = Object.fromEntries(
    names.map((name) => [name, median(faces.map((f) => f.blendshapes[name] ?? 0))]),
  )
  const pose = {
    yaw: median(faces.map((f) => f.pose.yaw)),
    pitch: median(faces.map((f) => f.pose.pitch)),
    roll: median(faces.map((f) => f.pose.roll)),
  }
  return { blendshapes, pose }
}
