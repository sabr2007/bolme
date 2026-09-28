import type { Features } from '../features/features'
import type { Evaluation, GestureDef, GesturePart } from './types'

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function isPartSatisfied(part: GesturePart, value: number): boolean {
  return (part.min === undefined || value >= part.min) && (part.max === undefined || value <= part.max)
}

/**
 * Scores one frame against a gesture. `missing` is the first unmet part in definition order,
 * so parts are listed from "most basic" to "finest detail" and the hint names the next thing to fix.
 */
export function evaluate(def: GestureDef, f: Features): Evaluation {
  const measured = def.parts.map((part) => ({ part, value: part.measure(f) }))
  const drivers = measured.filter(({ part }) => part.min !== undefined && part.min > 0)
  const progress = drivers.length
    ? drivers.reduce((sum, { part, value }) => sum + clamp01(value / (part.min as number)), 0) / drivers.length
    : 0
  const missing = measured.find(({ part, value }) => !isPartSatisfied(part, value))?.part ?? null
  const confuser = def.confusers?.find((c) => c.test(f)) ?? null
  return { gesture: def.id, progress, satisfied: missing === null, missing, confuser }
}
