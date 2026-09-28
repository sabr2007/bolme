import { useCallback, useRef, useState } from 'react'
import { Soundscape } from './audio/soundscape'
import { DebugPanel } from './components/DebugPanel'
import { Reflection } from './components/Reflection'
import { FaceEngine } from './engine/faceEngine'
import { FaceEngineContext, useEngineSelector } from './engine/useFaceEngine'
import { FilmScreen, type FilmResult } from './screens/FilmScreen'
import { ResultScreen } from './screens/ResultScreen'
import { TicketCheck } from './screens/TicketCheck'
import { TitleScreen } from './screens/TitleScreen'
import { NIGHT_TRAIN } from './story/nightTrain'

type Phase = 'title' | 'ticket' | 'film' | 'result'

const DEBUG = new URLSearchParams(window.location.search).has('debug')

function Journey({ engine, sound }: { engine: FaceEngine; sound: Soundscape }) {
  const camera = useRef<HTMLVideoElement>(null)
  // select primitives only: the full snapshot changes on every camera frame
  const status = useEngineSelector((s) => s.status)
  const error = useEngineSelector((s) => s.error)
  const [phase, setPhase] = useState<Phase>('title')
  const [result, setResult] = useState<FilmResult | null>(null)
  const [ride, setRide] = useState(0)

  const board = useCallback(async () => {
    sound.start()
    if (camera.current && (await engine.start(camera.current))) setPhase('ticket')
  }, [engine, sound])

  const endFilm = useCallback((filmResult: FilmResult) => {
    setResult(filmResult)
    setPhase('result')
  }, [])

  const startFilm = useCallback(() => setPhase('film'), [])

  const replay = useCallback(() => {
    setRide((n) => n + 1)
    setPhase('film')
  }, [])

  return (
    <>
      <video ref={camera} className="visually-hidden" playsInline muted aria-hidden="true" />
      {phase === 'title' && <TitleScreen status={status} error={error} onBoard={board} />}
      {phase === 'ticket' && <TicketCheck sound={sound} onDone={startFilm} />}
      {phase === 'film' && <FilmScreen key={ride} story={NIGHT_TRAIN} sound={sound} onEnd={endFilm} />}
      {phase === 'result' && result && <ResultScreen story={NIGHT_TRAIN} result={result} onReplay={replay} />}
      {phase !== 'title' && <Reflection camera={camera} />}
      {DEBUG && phase !== 'title' && <DebugPanel />}
    </>
  )
}

export default function App() {
  const [engine] = useState(() => new FaceEngine())
  const [sound] = useState(() => new Soundscape())
  return (
    <FaceEngineContext.Provider value={engine}>
      <Journey engine={engine} sound={sound} />
      <div className="grain" aria-hidden="true" />
    </FaceEngineContext.Provider>
  )
}
