import type { Blendshapes, HeadPose } from '../face/types'

/** The viewer's neutral face, captured during calibration. */
export type Baseline = Readonly<{ blendshapes: Blendshapes; pose: HeadPose }>

/**
 * Expression signals relative to the viewer's own neutral face, so a resting smile or naturally
 * low brows do not count as a gesture. All expression values are 0..1, angles are degrees.
 */
export type Features = Readonly<{
  smile: number
  squint: number
  browDown: number
  browDownMin: number
  browUp: number
  jawOpen: number
  eyesClosed: number
  eyeWide: number
  mouthStretch: number
  gazeAside: number
  yaw: number
  pitch: number
  roll: number
}>

export const NEUTRAL_BASELINE: Baseline = { blendshapes: {}, pose: { yaw: 0, pitch: 0, roll: 0 } }

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const mean = (...values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

export function computeFeatures(raw: Blendshapes, pose: HeadPose, baseline: Baseline): Features {
  const base = baseline.blendshapes
  const get = (name: string) => raw[name] ?? 0
  /** Rise above neutral, rescaled so the remaining range still reaches 1. */
  const rise = (name: string) => {
    const b = base[name] ?? 0
    return b >= 1 ? 0 : clamp01((get(name) - b) / (1 - b))
  }

  const browDownLeft = rise('browDownLeft')
  const browDownRight = rise('browDownRight')

  return {
    smile: mean(rise('mouthSmileLeft'), rise('mouthSmileRight')),
    squint: Math.max(mean(rise('eyeSquintLeft'), rise('eyeSquintRight')), mean(rise('cheekSquintLeft'), rise('cheekSquintRight'))),
    browDown: mean(browDownLeft, browDownRight),
    browDownMin: Math.min(browDownLeft, browDownRight),
    browUp: Math.max(rise('browInnerUp'), mean(rise('browOuterUpLeft'), rise('browOuterUpRight'))),
    jawOpen: rise('jawOpen'),
    eyesClosed: mean(rise('eyeBlinkLeft'), rise('eyeBlinkRight')),
    eyeWide: mean(rise('eyeWideLeft'), rise('eyeWideRight')),
    mouthStretch: mean(rise('mouthStretchLeft'), rise('mouthStretchRight')),
    gazeAside: Math.max(
      mean(get('eyeLookOutLeft'), get('eyeLookInRight')),
      mean(get('eyeLookOutRight'), get('eyeLookInLeft')),
    ),
    yaw: pose.yaw - baseline.pose.yaw,
    pitch: pose.pitch - baseline.pose.pitch,
    roll: pose.roll - baseline.pose.roll,
  }
}
