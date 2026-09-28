import { useCallback, useEffect, useRef, useState } from 'react'
import type { Soundscape } from '../audio/soundscape'
import { GestureOption } from '../components/GestureOption'
import { HintBar } from '../components/HintBar'
import { useEngine, useEngineSnapshot, useGestureEvents } from '../engine/useFaceEngine'
import type { GestureEvent } from '../gestures/tracker'
import { ClipPlayer } from '../player/ClipPlayer'
import {
  STEP_PRAISE_MS, STEP_TIMEOUT_LINE, STEP_TIMEOUT_MS, TICKET_ACCEPTED_LINE, TICKET_STEPS,
} from '../story/ticketCheck'
import './ticketCheck.css'

const IDLE_CLIP = `${import.meta.env.BASE_URL}media/ticket-idle.mp4`
const ACCEPTED_PAUSE_MS = 1800

interface TicketCheckProps {
  sound: Soundscape
  onDone: () => void
}

type Phase = 'asking' | 'passed' | 'skipped' | 'accepted'

/** The in-world tutorial: calibration + one attempt at every gesture, with live coaching. */
export function TicketCheck({ sound, onDone }: TicketCheckProps) {
  const engine = useEngine()
  const { meters, calibrationProgress, calibrating } = useEngineSnapshot()
  const [stepIndex, setStepIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('asking')
  /** steps passed by a recognized gesture (not by timeout); exposed for e2e tests */
  const [passed, setPassed] = useState(0)
  const timeRef = useRef(0)
  const step = TICKET_STEPS[stepIndex]

  const advance = useCallback((result: Phase) => {
    setPhase(result)
    if (result === 'passed') {
      sound.chime()
      setPassed((n) => n + 1)
    }
    window.setTimeout(() => {
      if (stepIndex + 1 < TICKET_STEPS.length) {
        setStepIndex(stepIndex + 1)
        setPhase('asking')
      } else {
        setPhase('accepted')
        window.setTimeout(onDone, ACCEPTED_PAUSE_MS)
      }
    }, result === 'passed' ? STEP_PRAISE_MS : STEP_PRAISE_MS * 2)
  }, [onDone, sound, stepIndex])

  // arm the current step: calibration or one allowed gesture, plus the "don't get stuck" timeout
  useEffect(() => {
    if (phase !== 'asking') return
    let cancelled = false
    if (step.gesture === 'calibrate') {
      engine.setAllowed([])
      void engine.calibrate().then((ok) => {
        if (!cancelled) advance(ok ? 'passed' : 'skipped')
      })
    } else {
      engine.setAllowed([step.gesture])
    }
    const timeout = window.setTimeout(() => !cancelled && advance('skipped'), STEP_TIMEOUT_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [advance, engine, phase, step])

  const handleGesture = useCallback((event: GestureEvent) => {
    if (phase === 'asking' && event.type === 'recognized' && event.gesture === step.gesture) advance('passed')
  }, [advance, phase, step])
  useGestureEvents(handleGesture)

  const line = phase === 'accepted' ? TICKET_ACCEPTED_LINE : phase === 'skipped' ? STEP_TIMEOUT_LINE : step.line
  return (
    <main className="ticket-check">
      <ClipPlayer src={IDLE_CLIP} playbackKey="ticket" loop timeRef={timeRef} />
      <div className="scrim" aria-hidden="true" />
      <HintBar />
      <section className="ticket-panel" aria-live="polite" data-step={step.id} data-passed={passed}>
        <p className="ticket-step">Проверка билета · {Math.min(stepIndex + 1, TICKET_STEPS.length)} / {TICKET_STEPS.length}</p>
        <p key={line} className="ticket-line">{line}</p>
        <div className={`ticket-gesture ${phase === 'passed' ? 'is-passed' : ''}`}>
          {step.gesture === 'calibrate' ? (
            <div className="calibration">
              <div className="calibration-bar"><span style={{ transform: `scaleX(${calibrating ? calibrationProgress : phase === 'asking' ? 0 : 1})` }} /></div>
              <span className="calibration-text">Смотрите прямо, лицо спокойное</span>
            </div>
          ) : (
            <GestureOption gesture={step.gesture} meaning={phase === 'passed' ? 'Принято' : ' '} meter={meters[step.gesture]} />
          )}
        </div>
      </section>
    </main>
  )
}
