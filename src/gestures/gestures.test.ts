import { describe, expect, it } from 'vitest'
import type { Features } from '../features/features'
import { GESTURES, T } from './definitions'
import { evaluate } from './evaluate'
import { createTracker, NEAR_MISS_DWELL_MS, stepTracker, type GestureEvent, type TrackerState } from './tracker'
import type { GestureId } from './types'

const NEUTRAL: Features = {
  smile: 0, squint: 0, browDown: 0, browDownMin: 0, browUp: 0, jawOpen: 0, eyesClosed: 0,
  eyeWide: 0, mouthStretch: 0, gazeAside: 0, yaw: 0, pitch: 0, roll: 0,
}
const face = (patch: Partial<Features>): Features => ({ ...NEUTRAL, ...patch })

/** Feeds the same features for `ms` at 30 fps and collects every event. */
function hold(state: TrackerState, f: Features, fromT: number, ms: number) {
  let current = state
  const events: GestureEvent[] = []
  for (let t = fromT; t <= fromT + ms; t += 33) {
    const result = stepTracker(current, f, t)
    current = result.state
    events.push(...result.events)
  }
  return { state: current, events, endT: fromT + ms }
}

const hints = (events: readonly GestureEvent[]) =>
  events.flatMap((e) => (e.type === 'hint' ? [e.text] : []))
const recognized = (events: readonly GestureEvent[]): GestureId[] =>
  events.flatMap((e) => (e.type === 'recognized' ? [e.gesture] : []))

describe('evaluate', () => {
  it('names the eyes as the missing part of a mouth-only smile', () => {
    const ev = evaluate(GESTURES.smile, face({ smile: 0.7, squint: 0.02 }))
    expect(ev.satisfied).toBe(false)
    expect(ev.missing?.id).toBe('eyes')
  })

  it('accepts a smile that reaches the eyes', () => {
    expect(evaluate(GESTURES.smile, face({ smile: 0.7, squint: 0.3 })).satisfied).toBe(true)
  })

  it('calls out a one-sided frown instead of asking to frown harder', () => {
    // left brow fully down (0.6), right brow neutral
    const f = face({ browDown: 0.3, browDownMin: 0 })
    const ev = evaluate(GESTURES.frown, f)
    expect(ev.missing?.hint(f)).toMatch(/обе брови/)
  })

  it('blocks a frown while the viewer is smiling', () => {
    const ev = evaluate(GESTURES.frown, face({ browDown: 0.5, browDownMin: 0.4, smile: 0.6 }))
    expect(ev.missing?.id).toBe('no-smile')
  })

  it('tells the viewer to open the mouth when only the brows are raised', () => {
    const f = face({ browUp: 0.6, jawOpen: 0.02 })
    expect(evaluate(GESTURES.surprise, f).missing?.hint(f)).toMatch(/приоткрой рот/i)
  })

  it('reports how many degrees are still missing for a head turn', () => {
    const f = face({ yaw: T.turnDeg - 6 })
    expect(evaluate(GESTURES.turnLeft, f).missing?.hint(f)).toContain('ещё примерно 6°')
  })

  it('does not count a left turn as progress towards a right turn', () => {
    expect(evaluate(GESTURES.turnRight, face({ yaw: 30 })).progress).toBe(0)
  })
})

describe('stepTracker', () => {
  it('recognizes a gesture only after it is held for holdMs', () => {
    const start = createTracker(['smile', 'frown'])
    const short = hold(start, face({ smile: 0.7, squint: 0.3 }), 0, GESTURES.smile.holdMs - 100)
    expect(recognized(short.events)).toEqual([])
    const long = hold(start, face({ smile: 0.7, squint: 0.3 }), 0, GESTURES.smile.holdMs + 50)
    expect(recognized(long.events)).toEqual(['smile'])
  })

  it('gives a specific near-miss hint after the viewer keeps trying', () => {
    const run = hold(createTracker(['smile', 'frown']), face({ smile: 0.7, squint: 0.0 }), 0, NEAR_MISS_DWELL_MS + 100)
    expect(hints(run.events)).toEqual(['Улыбка только губами — прищурь глаза, улыбнись по-настоящему'])
  })

  it('stays quiet for idle faces', () => {
    const run = hold(createTracker(['smile', 'frown', 'surprise']), NEUTRAL, 0, 5000)
    expect(run.events).toEqual([])
  })

  it('reports exactly how long the eyes stayed closed when opened too early', () => {
    const closed = hold(createTracker(['eyesClosed']), face({ eyesClosed: 0.9 }), 0, 1200)
    const opened = hold(closed.state, NEUTRAL, closed.endT + 33, 100)
    expect(hints(opened.events)).toEqual(['Ты подсмотрел через 1,2 с — держи глаза закрытыми 2 секунды'])
  })

  it('ignores a normal blink', () => {
    const blink = hold(createTracker(['eyesClosed']), face({ eyesClosed: 0.9 }), 0, 150)
    const after = hold(blink.state, NEUTRAL, blink.endT + 33, 500)
    expect(after.events).toEqual([])
  })

  it('catches the eyes-only turn as a typical mistake', () => {
    const run = hold(createTracker(['turnLeft', 'turnRight']), face({ gazeAside: 0.7, yaw: 2 }), 0, 800)
    expect(hints(run.events)).toEqual(['Ты смотришь в сторону только глазами — поверни всю голову'])
  })

  it('says "wrong side" when the viewer turns the other way', () => {
    const run = hold(createTracker(['turnLeft']), face({ yaw: -30 }), 0, 800)
    expect(hints(run.events)).toEqual(['Не в ту сторону — поверни голову влево'])
  })

  it('treats the opposite turn as an answer, not a mistake, when both sides are offered', () => {
    const run = hold(createTracker(['turnLeft', 'turnRight']), face({ yaw: -30 }), 0, 800)
    expect(recognized(run.events)).toEqual(['turnRight'])
    expect(hints(run.events)).toEqual([])
  })

  it('does not repeat the same hint every frame', () => {
    const run = hold(createTracker(['smile']), face({ smile: 0.7 }), 0, 2500)
    expect(hints(run.events)).toHaveLength(1)
  })
})
