import type { Features } from '../features/features'

/**
 * The passive layer: how the viewer feels right now, smoothed over time. It never triggers
 * a branch by itself during a choice; it colors the film (music, grade, pacing) and decides
 * the branch only when the viewer does not answer.
 */
export interface Mood {
  readonly fear: number
  readonly joy: number
  readonly boredom: number
  readonly t: number
}

export type MoodLabel = 'fear' | 'joy' | 'boredom' | 'calm'

const FEAR_TAU_MS = 1200
const JOY_TAU_MS = 1200
const BOREDOM_TAU_MS = 8000
const LOOK_AWAY_YAW_DEG = 30
const LOOK_AWAY_PITCH_DEG = 25
const LOOK_AWAY_GAZE = 0.6
const EXPRESSIVE_SUM = 0.35

export const INITIAL_MOOD: Mood = { fear: 0, joy: 0, boredom: 0, t: 0 }

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const ema = (prev: number, next: number, dtMs: number, tauMs: number) =>
  prev + (next - prev) * (1 - Math.exp(-dtMs / tauMs))

function fearOf(f: Features): number {
  // raised inner brows + widened eyes + stretched mouth = the classic fear/tension triad
  return clamp01(1.2 * (0.5 * f.browUp + 0.3 * f.eyeWide + 0.2 * f.mouthStretch))
}

function boredomOf(f: Features | null): number {
  if (f === null) return 1
  const lookingAway = Math.abs(f.yaw) > LOOK_AWAY_YAW_DEG
    || Math.abs(f.pitch) > LOOK_AWAY_PITCH_DEG
    || f.gazeAside > LOOK_AWAY_GAZE
  if (lookingAway) return 1
  const expressiveness = f.smile + f.browUp + f.browDown + f.eyeWide + f.jawOpen
  return clamp01(1 - expressiveness / EXPRESSIVE_SUM)
}

/** @param f features of this frame, or null when the face is not visible */
export function stepMood(prev: Mood, f: Features | null, t: number): Mood {
  const dt = prev.t === 0 ? 0 : Math.max(0, t - prev.t)
  return {
    fear: ema(prev.fear, f ? fearOf(f) : prev.fear, dt, FEAR_TAU_MS),
    joy: ema(prev.joy, f ? f.smile : 0, dt, JOY_TAU_MS),
    boredom: ema(prev.boredom, boredomOf(f), dt, BOREDOM_TAU_MS),
    t,
  }
}

export function dominantMood(mood: Mood): MoodLabel {
  const ranked: Array<[MoodLabel, number]> = [
    ['fear', mood.fear],
    ['joy', mood.joy],
    ['boredom', mood.boredom * 0.8],
  ]
  const [label, value] = ranked.reduce((best, next) => (next[1] > best[1] ? next : best))
  return value >= 0.35 ? label : 'calm'
}
