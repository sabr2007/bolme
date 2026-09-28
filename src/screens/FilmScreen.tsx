import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Soundscape } from '../audio/soundscape'
import { HintBar } from '../components/HintBar'
import { Subtitles } from '../components/Subtitles'
import { useEngine, useGestureEvents } from '../engine/useFaceEngine'
import type { GestureEvent } from '../gestures/tracker'
import { dominantMood } from '../mood/mood'
import { prefetch } from '../player/mediaCache'
import { ClipPlayer } from '../player/ClipPlayer'
import { upcomingClips } from '../story/navigation'
import { resolveLine, type Ending, type Story } from '../story/types'
import { ChoiceOverlay } from './ChoiceOverlay'
import './filmScreen.css'

const MOOD_TICK_MS = 400
const BOREDOM_KNOCK = 0.75
const KNOCK_LINE = 'Тук-тук. «Не спите, пассажир».'
const KNOCK_VISIBLE_MS = 2600
const DEFAULT_BLACK_S = 5
/** story clips are 5 s at 16 fps; slightly slower reads calmer and leaves time for the subtitles */
const STORY_PLAYBACK_RATE = 0.85

export interface FearSample {
  readonly t: number
  readonly fear: number
  readonly scene: string
}

export interface FilmResult {
  readonly ending: Ending
  readonly epilogue: string
  readonly path: readonly string[]
  readonly fear: readonly FearSample[]
  readonly hints: number
  readonly recognized: number
  readonly timeouts: number
}

interface FilmScreenProps {
  story: Story
  sound: Soundscape
  onEnd: (result: FilmResult) => void
}

type Mode = 'clip' | 'choice'

export function FilmScreen({ story, sound, onEnd }: FilmScreenProps) {
  const engine = useEngine()
  const [sceneId, setSceneId] = useState(story.start)
  const [mode, setMode] = useState<Mode>('clip')
  const [path, setPath] = useState<readonly string[]>([story.start])
  const [knockAt, setKnockAt] = useState<number | null>(null)
  const timeRef = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const stats = useRef({ hints: 0, recognized: 0, timeouts: 0 })
  const fearLog = useRef<readonly FearSample[]>([])
  const startedAt = useRef(performance.now())
  const knockedIn = useRef<string | null>(null)

  const scene = story.scenes[sceneId]
  const visited = useMemo(() => new Set(path), [path])
  const lineContext = useCallback(
    () => ({ mood: dominantMood(engine.getSnapshot().mood), visited }),
    [engine, visited],
  )

  const goTo = useCallback((next: string) => {
    setSceneId(next)
    setMode('clip')
    setPath((prev) => [...prev, next])
  }, [])

  const finish = useCallback((ending: Ending) => {
    onEnd({
      ending,
      epilogue: resolveLine(ending.epilogue, lineContext()),
      path,
      fear: fearLog.current,
      ...stats.current,
    })
  }, [lineContext, onEnd, path])

  const handleClipEnded = useCallback(() => {
    if (mode !== 'clip') return
    if (scene.kind === 'linear') goTo(scene.next)
    else if (scene.kind === 'choice') setMode('choice')
    else finish(scene.ending)
  }, [finish, goTo, mode, scene])

  // prefetch everything reachable from here so branch switches never wait for the network
  useEffect(() => {
    upcomingClips(story, scene).forEach((src) => void prefetch(src))
  }, [scene, story])

  // gestures are only live during a decision
  useEffect(() => {
    engine.setAllowed(mode === 'choice' && scene.kind === 'choice' ? scene.choice.options.map((o) => o.gesture) : [])
  }, [engine, mode, scene])

  // no answer → the passive mood layer decides
  useEffect(() => {
    if (mode !== 'choice' || scene.kind !== 'choice') return
    const timer = window.setTimeout(() => {
      stats.current = { ...stats.current, timeouts: stats.current.timeouts + 1 }
      goTo(scene.choice.fallback(engine.getSnapshot().mood))
    }, scene.choice.timeoutMs)
    return () => window.clearTimeout(timer)
  }, [engine, goTo, mode, scene])

  const handleGesture = useCallback((event: GestureEvent) => {
    if (event.type === 'hint') {
      stats.current = { ...stats.current, hints: stats.current.hints + 1 }
      return
    }
    if (mode !== 'choice' || scene.kind !== 'choice') return
    const option = scene.choice.options.find((o) => o.gesture === event.gesture)
    if (!option) return
    sound.chime()
    stats.current = { ...stats.current, recognized: stats.current.recognized + 1 }
    goTo(option.next)
  }, [goTo, mode, scene, sound])
  useGestureEvents(handleGesture)

  // passive layer: sound tension, color grade, fear curve, and a knock when the viewer drifts away
  useEffect(() => {
    const timer = window.setInterval(() => {
      const { mood } = engine.getSnapshot()
      sound.setTension(mood.fear)
      stageRef.current?.style.setProperty('--fear', mood.fear.toFixed(3))
      stageRef.current?.style.setProperty('--joy', mood.joy.toFixed(3))
      fearLog.current = [...fearLog.current, { t: performance.now() - startedAt.current, fear: mood.fear, scene: sceneId }]
      if (mode === 'clip' && scene.kind === 'linear' && mood.boredom > BOREDOM_KNOCK && knockedIn.current !== sceneId) {
        knockedIn.current = sceneId
        sound.knock()
        setKnockAt(performance.now())
      }
    }, MOOD_TICK_MS)
    return () => window.clearInterval(timer)
  }, [engine, mode, scene, sceneId, sound])

  useEffect(() => {
    if (knockAt === null) return
    const timer = window.setTimeout(() => setKnockAt(null), KNOCK_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [knockAt])

  // a black clip (e.g. hiding with closed eyes) has no video, so it is timed here
  useEffect(() => {
    if (mode !== 'clip' || scene.clip.src !== null) return
    const started = performance.now()
    const durationMs = (scene.clip.durationS ?? DEFAULT_BLACK_S) * 1000
    let frame = 0
    const tick = () => {
      const elapsed = performance.now() - started
      timeRef.current = elapsed / 1000
      if (elapsed >= durationMs) handleClipEnded()
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [handleClipEnded, mode, scene])

  const choice = scene.kind === 'choice' ? scene.choice : null
  const playing = mode === 'choice' && choice ? choice.idle : scene.clip
  return (
    <main className="film-screen">
      <div ref={stageRef} className="film-stage">
        <ClipPlayer
          src={playing.src}
          playbackKey={`${sceneId}:${mode}`}
          loop={mode === 'choice'}
          playbackRate={STORY_PLAYBACK_RATE}
          onEnded={handleClipEnded}
          timeRef={timeRef}
        />
        <div className="film-grade" aria-hidden="true" />
      </div>
      <div className="letterbox top" aria-hidden="true" />
      <div className="letterbox bottom" aria-hidden="true" />
      {mode === 'clip' && <HintBar />}
      {mode === 'clip' && scene.clip.subtitles && (
        <Subtitles cues={scene.clip.subtitles} timeRef={timeRef} context={lineContext} clipKey={sceneId} />
      )}
      {mode === 'choice' && choice && (
        <ChoiceOverlay choice={choice} prompt={resolveLine(choice.prompt, lineContext())} />
      )}
      {knockAt !== null && <div className="knock" role="status"><p>{KNOCK_LINE}</p></div>}
    </main>
  )
}
