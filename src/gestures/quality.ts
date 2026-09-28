import type { FaceFrame } from '../face/types'

/** Problems with the camera picture itself; they take priority over gesture hints. */
export type QualityIssueId = 'no-face' | 'too-far' | 'too-close' | 'off-center' | 'too-dark'

export interface QualityIssue {
  readonly id: QualityIssueId
  readonly text: string
}

export const Q = {
  noFaceGraceMs: 800,
  minFaceWidth: 0.16,
  maxFaceWidth: 0.7,
  centerMargin: 0.18,
  minBrightness: 0.16,
} as const

const TEXT: Readonly<Record<QualityIssueId, string>> = {
  'no-face': 'Не вижу лица — сядь напротив камеры',
  'too-far': 'Сядь ближе — лицо слишком далеко от камеры',
  'too-close': 'Отодвинься чуть дальше от камеры',
  'off-center': 'Сдвинься так, чтобы лицо было в центре окна',
  'too-dark': 'Слишком темно — пусть экран или лампа освещает лицо',
}

const issue = (id: QualityIssueId): QualityIssue => ({ id, text: TEXT[id] })

/**
 * @param msWithoutFace how long no face has been detected (0 when the face is visible)
 * @param brightness mean luma of the camera picture 0..1, or null when not measured yet
 */
export function checkQuality(frame: FaceFrame, msWithoutFace: number, brightness: number | null): QualityIssue | null {
  if (brightness !== null && brightness < Q.minBrightness) return issue('too-dark')
  if (!frame.present) return msWithoutFace >= Q.noFaceGraceMs ? issue('no-face') : null

  const { cx, cy, width } = frame.box
  if (width < Q.minFaceWidth) return issue('too-far')
  if (width > Q.maxFaceWidth) return issue('too-close')
  const outside = (v: number) => v < Q.centerMargin || v > 1 - Q.centerMargin
  if (outside(cx) || outside(cy)) return issue('off-center')
  return null
}
