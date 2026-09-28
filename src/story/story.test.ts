import { describe, expect, it } from 'vitest'
import { INITIAL_MOOD } from '../mood/mood'
import { ENDING_COUNT, NIGHT_TRAIN, passengerProfile } from './nightTrain'
import { resolveLine, type Scene } from './types'

const scenes = Object.values(NIGHT_TRAIN.scenes)

function targetsOf(scene: Scene): string[] {
  if (scene.kind === 'linear') return [scene.next]
  if (scene.kind === 'choice') return scene.choice.options.map((o) => o.next)
  return []
}

function reachable(from: string): Set<string> {
  const seen = new Set<string>()
  const queue = [from]
  while (queue.length) {
    const id = queue.shift() as string
    if (seen.has(id)) continue
    seen.add(id)
    queue.push(...targetsOf(NIGHT_TRAIN.scenes[id]))
  }
  return seen
}

describe('Night Train story graph', () => {
  it('only points to scenes that exist', () => {
    for (const scene of scenes) {
      for (const target of targetsOf(scene)) expect(NIGHT_TRAIN.scenes[target], `${scene.id} -> ${target}`).toBeDefined()
    }
  })

  it('reaches every scene and all 4 endings from the start', () => {
    const seen = reachable(NIGHT_TRAIN.start)
    expect([...seen].sort()).toEqual(scenes.map((s) => s.id).sort())
    expect(ENDING_COUNT).toBe(4)
  })

  it('has fallbacks that pick one of the offered options for any mood', () => {
    const moods = [INITIAL_MOOD, { ...INITIAL_MOOD, fear: 1 }, { ...INITIAL_MOOD, joy: 1 }, { ...INITIAL_MOOD, boredom: 1 }]
    for (const scene of scenes) {
      if (scene.kind !== 'choice') continue
      const options = scene.choice.options.map((o) => o.next)
      for (const mood of moods) expect(options).toContain(scene.choice.fallback(mood))
    }
  })

  it('offers distinct gestures at every choice', () => {
    for (const scene of scenes) {
      if (scene.kind !== 'choice') continue
      const gestures = scene.choice.options.map((o) => o.gesture)
      expect(new Set(gestures).size).toBe(gestures.length)
    }
  })

  it('adapts the stranger greeting to the path and the mood', () => {
    const cue = NIGHT_TRAIN.scenes.stranger.clip.subtitles?.[0]
    expect(cue).toBeDefined()
    const text = (mood: 'calm' | 'fear', visited: string[]) => resolveLine(cue!.text, { mood, visited: new Set(visited) })
    expect(text('calm', ['vestibule'])).toMatch(/тамбур/)
    expect(text('calm', ['dining'])).toMatch(/ресторан/)
    expect(text('fear', ['dining'])).toMatch(/Не бойтесь/)
  })

  it('builds the passenger profile from the path', () => {
    expect(passengerProfile(new Set(['vestibule', 'refuse', 'callOutAfterRefuse']))).toEqual([
      'Пошёл на стук', 'Не поверил', 'Окликнул',
    ])
  })
})
