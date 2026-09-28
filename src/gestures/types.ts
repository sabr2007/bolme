import type { Features } from '../features/features'

export type GestureId = 'turnLeft' | 'turnRight' | 'smile' | 'frown' | 'surprise' | 'eyesClosed'

/**
 * One measurable part of a gesture. `min` parts drive progress ("how far along is the viewer"),
 * `max` parts are guards ("this must NOT happen", e.g. smiling while frowning).
 * When a part is the reason the gesture is not recognized, its hint tells the viewer exactly what to fix.
 */
export type GesturePart = Readonly<{
  id: string
  measure: (f: Features) => number
  min?: number
  max?: number
  hint: (f: Features) => string
}>

/** A typical wrong movement recognized on its own, e.g. turning only the eyes instead of the head. */
export type Confuser = Readonly<{
  id: string
  test: (f: Features) => boolean
  hint: string
}>

export type GestureDef = Readonly<{
  id: GestureId
  label: string
  instruction: string
  holdMs: number
  parts: readonly GesturePart[]
  confusers?: readonly Confuser[]
  releasedEarlyHint?: (heldMs: number) => string
}>

export type Evaluation = Readonly<{
  gesture: GestureId
  progress: number
  satisfied: boolean
  missing: GesturePart | null
  confuser: Confuser | null
}>
