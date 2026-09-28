import { useCallback, useEffect, useMemo, useState } from 'react'
import { GestureOption } from '../components/GestureOption'
import { useEngine, useEngineSnapshot, useGestureEvents } from '../engine/useFaceEngine'
import type { GestureEvent } from '../gestures/tracker'
import { saveEnding } from '../progress/endings'
import { ENDING_COUNT, passengerProfile } from '../story/nightTrain'
import type { Story } from '../story/types'
import type { FilmResult } from './FilmScreen'
import './resultScreen.css'

const CHART_W = 520
const CHART_H = 90

interface ResultScreenProps {
  story: Story
  result: FilmResult
  onReplay: () => void
}

function fearPath(result: FilmResult): string {
  const samples = result.fear
  if (samples.length < 2) return ''
  const end = samples[samples.length - 1].t || 1
  return samples
    .map((s, i) => `${i ? 'L' : 'M'}${((s.t / end) * CHART_W).toFixed(1)},${(CHART_H - s.fear * (CHART_H - 6) - 3).toFixed(1)}`)
    .join(' ')
}

function peakStation(story: Story, result: FilmResult): string | null {
  const peak = result.fear.reduce<FilmResult['fear'][number] | null>((best, s) => (!best || s.fear > best.fear ? s : best), null)
  return peak && peak.fear > 0.15 ? story.scenes[peak.scene]?.station ?? null : null
}

/** "Твой билет": the finished-scenario summary required by the brief, styled as a railway ticket. */
export function ResultScreen({ story, result, onReplay }: ResultScreenProps) {
  const engine = useEngine()
  const { meters } = useEngineSnapshot()
  const [collected] = useState(() => saveEnding(result.ending.id))
  const visited = useMemo(() => new Set(result.path), [result.path])
  const stations = useMemo(
    () => result.path.map((id) => story.scenes[id]?.station).filter((s, i, all) => s && s !== all[i - 1]),
    [result.path, story],
  )
  const peak = peakStation(story, result)
  const accuracy = result.recognized + result.hints > 0
    ? Math.round((result.recognized / (result.recognized + result.hints)) * 100)
    : null

  useEffect(() => engine.setAllowed(['smile']), [engine])
  const handleGesture = useCallback((event: GestureEvent) => {
    if (event.type === 'recognized' && event.gesture === 'smile') onReplay()
  }, [onReplay])
  useGestureEvents(handleGesture)

  return (
    <main className="result-screen">
      <article className="ticket" aria-labelledby="ending-title">
        <header className="ticket-head">
          <span>Ночной поезд · билет пассажира</span>
          <span>Концовка {collected.size} из {ENDING_COUNT} открыта</span>
        </header>
        <h1 id="ending-title">{result.ending.title}</h1>
        <p className="ticket-epilogue">{result.epilogue}</p>

        <ol className="ticket-route" aria-label="Маршрут">
          {stations.map((station, i) => <li key={`${station}-${i}`}>{station}</li>)}
        </ol>

        <section className="ticket-grid">
          <div>
            <h2>Профиль пассажира</h2>
            <ul className="ticket-profile">
              {passengerProfile(visited).map((trait) => <li key={trait}>{trait}</li>)}
            </ul>
          </div>
          <div>
            <h2>Кардиограмма страха</h2>
            <svg className="fear-chart" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img"
              aria-label={peak ? `Сильнее всего страх был: ${peak}` : 'График страха по ходу фильма'}>
              <path d={fearPath(result)} />
            </svg>
            <p className="ticket-note">{peak ? `Сильнее всего страшно было здесь: ${peak}` : 'Вы были спокойны всю дорогу'}</p>
          </div>
          <div>
            <h2>Жесты</h2>
            <p className="ticket-stat"><strong>{result.recognized}</strong> распознано · <strong>{result.hints}</strong> подсказок</p>
            <p className="ticket-note">
              {accuracy === null ? 'Решения принимал поезд' : `Точность с первой попытки: ${accuracy}%`}
              {result.timeouts > 0 && ` · ${result.timeouts} раз решило настроение`}
            </p>
          </div>
        </section>

        <footer className="ticket-foot">
          <GestureOption gesture="smile" meaning="Улыбнитесь, чтобы проехать снова" meter={meters.smile} side="left" />
          <button className="ticket-replay" onClick={onReplay}>или нажмите здесь</button>
        </footer>
      </article>
    </main>
  )
}
