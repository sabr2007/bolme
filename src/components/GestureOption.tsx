import type { GestureMeter } from '../gestures/tracker'
import type { GestureId } from '../gestures/types'
import { GESTURES } from '../gestures/definitions'
import { GestureIcon } from './GestureIcon'
import './gestureOption.css'

interface GestureOptionProps {
  gesture: GestureId
  meaning: string
  meter?: GestureMeter
  side?: 'left' | 'right' | 'center'
}

const RING_R = 34
const RING_C = 2 * Math.PI * RING_R

/**
 * Feedback for one gesture: the thin inner arc is "how close you are", the thick ring fills while
 * the gesture is held. Both come straight from the gesture tracker.
 */
export function GestureOption({ gesture, meaning, meter, side = 'center' }: GestureOptionProps) {
  const progress = meter?.progress ?? 0
  const hold = meter?.hold ?? 0
  const state = hold > 0 ? 'holding' : progress >= 0.45 ? 'trying' : 'idle'
  return (
    <div className={`gesture-option side-${side} state-${state}`}>
      <div className="gesture-ring">
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle className="ring-track" cx="40" cy="40" r={RING_R} />
          <circle className="ring-progress" cx="40" cy="40" r={RING_R - 5}
            strokeDasharray={2 * Math.PI * (RING_R - 5)}
            strokeDashoffset={2 * Math.PI * (RING_R - 5) * (1 - progress)} />
          <circle className="ring-hold" cx="40" cy="40" r={RING_R}
            strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - hold)} />
        </svg>
        <span className="gesture-glyph"><GestureIcon gesture={gesture} size={34} /></span>
      </div>
      <div className="gesture-text">
        <span className="gesture-meaning">{meaning}</span>
        <span className="gesture-how">{GESTURES[gesture].instruction}</span>
      </div>
    </div>
  )
}
