import type { GestureId } from '../gestures/types'
import type { Mood, MoodLabel } from '../mood/mood'

/** What a line of text may depend on: the viewer's current mood and the path taken so far. */
export interface LineContext {
  readonly mood: MoodLabel
  readonly visited: ReadonlySet<string>
}

/** Plain text, or text chosen at the moment it appears (mood / path variants cost no extra footage). */
export type Line = string | ((ctx: LineContext) => string)

export interface SubtitleCue {
  /** seconds from clip start */
  readonly at: number
  readonly until: number
  readonly text: Line
}

export interface Clip {
  /** null = black screen (e.g. the viewer is hiding with eyes closed); sound and subtitles still play */
  readonly src: string | null
  readonly durationS?: number
  readonly subtitles?: readonly SubtitleCue[]
}

export interface ChoiceOption {
  readonly gesture: GestureId
  /** what the choice means in the story, shown next to the gesture icon */
  readonly meaning: string
  readonly next: string
}

export interface Choice {
  /** the question shown while the viewer decides */
  readonly prompt: Line
  /** seamless loop (first frame == last frame == hub frame) played while waiting */
  readonly idle: Clip
  readonly options: readonly ChoiceOption[]
  readonly timeoutMs: number
  /** when the viewer does not answer, the passive mood layer picks the branch */
  readonly fallback: (mood: Mood) => string
}

export interface Ending {
  readonly id: string
  readonly title: string
  readonly epilogue: Line
}

interface SceneBase {
  readonly id: string
  /** name of the "station" on the result ticket */
  readonly station: string
  readonly clip: Clip
}

/** A scene is a clip followed by exactly one of: next scene, a choice, or an ending. */
export type Scene = SceneBase &
  (
    | Readonly<{ kind: 'linear'; next: string }>
    | Readonly<{ kind: 'choice'; choice: Choice }>
    | Readonly<{ kind: 'ending'; ending: Ending }>
  )

export interface Story {
  readonly title: string
  readonly start: string
  readonly scenes: Readonly<Record<string, Scene>>
}

export function resolveLine(line: Line, ctx: LineContext): string {
  return typeof line === 'function' ? line(ctx) : line
}
