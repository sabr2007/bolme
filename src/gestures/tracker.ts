import type { Features } from '../features/features'
import { GESTURES } from './definitions'
import { evaluate } from './evaluate'
import type { Evaluation, GestureId } from './types'

/** Near-miss: the viewer is clearly trying (progress above this) but one part is still off. */
export const NEAR_MISS_PROGRESS = 0.45
export const NEAR_MISS_DWELL_MS = 700
export const CONFUSER_DWELL_MS = 600
/** Holding shorter than this and letting go is a blink / twitch, not a failed attempt. */
export const MIN_HELD_FOR_RELEASE_HINT_MS = 350
export const HINT_MIN_GAP_MS = 1200
export const HINT_REPEAT_MS = 3000

export type HintReason = 'near-miss' | 'confuser' | 'released-early'

export type GestureEvent =
  | Readonly<{ type: 'recognized'; gesture: GestureId; t: number }>
  | Readonly<{ type: 'hint'; gesture: GestureId; reason: HintReason; key: string; text: string; t: number }>

interface Track {
  readonly activeSince: number | null
  readonly nearMissSince: number | null
  readonly confuserSince: number | null
}

export interface TrackerState {
  readonly allowed: readonly GestureId[]
  readonly tracks: Readonly<Partial<Record<GestureId, Track>>>
  readonly lastHint: Readonly<{ key: string; t: number }> | null
}

export interface GestureMeter {
  readonly progress: number
  readonly hold: number
}

export interface StepResult {
  readonly state: TrackerState
  readonly events: readonly GestureEvent[]
  readonly meters: Readonly<Partial<Record<GestureId, GestureMeter>>>
}

type HintEvent = Extract<GestureEvent, { type: 'hint' }>

const FRESH_TRACK: Track = { activeSince: null, nearMissSince: null, confuserSince: null }
const HINT_PRIORITY: Readonly<Record<HintReason, number>> = { 'released-early': 3, confuser: 2, 'near-miss': 1 }

export function createTracker(allowed: readonly GestureId[]): TrackerState {
  return { allowed, tracks: {}, lastHint: null }
}

interface GestureStep {
  readonly track: Track
  readonly meter: GestureMeter
  readonly recognized: boolean
  readonly hint: HintEvent | null
}

function stepGesture(id: GestureId, prev: Track, ev: Evaluation, f: Features, t: number): GestureStep {
  const def = GESTURES[id]
  const hintOf = (reason: HintReason, partId: string, text: string): HintEvent => ({
    type: 'hint', gesture: id, reason, key: `${id}:${partId}`, text, t,
  })

  if (ev.satisfied) {
    const activeSince = prev.activeSince ?? t
    const held = t - activeSince
    return {
      track: { activeSince, nearMissSince: null, confuserSince: null },
      meter: { progress: 1, hold: Math.min(1, held / def.holdMs) },
      recognized: held >= def.holdMs,
      hint: null,
    }
  }

  const heldBeforeRelease = prev.activeSince === null ? 0 : t - prev.activeSince
  const releasedEarly = heldBeforeRelease >= MIN_HELD_FOR_RELEASE_HINT_MS && def.releasedEarlyHint
    ? hintOf('released-early', 'released', def.releasedEarlyHint(heldBeforeRelease))
    : null

  const confuserSince = ev.confuser ? (prev.confuserSince ?? t) : null
  const confuserHint = ev.confuser && confuserSince !== null && t - confuserSince >= CONFUSER_DWELL_MS
    ? hintOf('confuser', ev.confuser.id, ev.confuser.hint)
    : null

  const trying = ev.progress >= NEAR_MISS_PROGRESS && ev.missing !== null
  const nearMissSince = trying ? (prev.nearMissSince ?? t) : null
  const nearMissHint = trying && ev.missing && nearMissSince !== null && t - nearMissSince >= NEAR_MISS_DWELL_MS
    ? hintOf('near-miss', ev.missing.id, ev.missing.hint(f))
    : null

  return {
    track: { activeSince: null, nearMissSince, confuserSince },
    meter: { progress: ev.progress, hold: 0 },
    recognized: false,
    hint: releasedEarly ?? confuserHint ?? nearMissHint,
  }
}

function shouldEmit(hint: HintEvent, last: TrackerState['lastHint']): boolean {
  if (hint.reason === 'released-early' || last === null) return true
  const gap = hint.t - last.t
  return gap >= HINT_MIN_GAP_MS && (hint.key !== last.key || gap >= HINT_REPEAT_MS)
}

/** Pure reducer: one camera frame in, new state + events out. */
export function stepTracker(state: TrackerState, f: Features, t: number): StepResult {
  const steps = state.allowed.map((id) => {
    const ev = evaluate(GESTURES[id], f)
    return { id, ev, step: stepGesture(id, state.tracks[id] ?? FRESH_TRACK, ev, f, t) }
  })

  const winner = steps.find(({ step }) => step.recognized)
  if (winner) {
    return {
      state: { ...state, tracks: {}, lastHint: state.lastHint },
      events: [{ type: 'recognized', gesture: winner.id, t }],
      meters: { [winner.id]: { progress: 1, hold: 1 } },
    }
  }

  const candidates = steps
    .filter(({ step }) => step.hint !== null)
    .sort((a, b) =>
      HINT_PRIORITY[(b.step.hint as HintEvent).reason] - HINT_PRIORITY[(a.step.hint as HintEvent).reason]
      || b.ev.progress - a.ev.progress)
  const hint = candidates[0]?.step.hint ?? null
  const emitted = hint && shouldEmit(hint, state.lastHint) ? hint : null

  return {
    state: {
      ...state,
      tracks: Object.fromEntries(steps.map(({ id, step }) => [id, step.track])),
      lastHint: emitted ? { key: emitted.key, t } : state.lastHint,
    },
    events: emitted ? [emitted] : [],
    meters: Object.fromEntries(steps.map(({ id, step }) => [id, step.meter])),
  }
}
