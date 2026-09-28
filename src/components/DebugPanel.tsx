import { useEngineSnapshot } from '../engine/useFaceEngine'
import { T } from '../gestures/definitions'
import type { Features } from '../features/features'
import './debugPanel.css'

interface Row {
  readonly label: string
  readonly key: keyof Features
  readonly threshold: number
  readonly scale: number
}

const ROWS: readonly Row[] = [
  { label: 'улыбка (губы)', key: 'smile', threshold: T.smile, scale: 1 },
  { label: 'прищур (глаза)', key: 'squint', threshold: T.smileSquint, scale: 1 },
  { label: 'брови вниз', key: 'browDown', threshold: T.browDown, scale: 1 },
  { label: 'слабая бровь', key: 'browDownMin', threshold: T.browDownEachSide, scale: 1 },
  { label: 'брови вверх', key: 'browUp', threshold: T.browUp, scale: 1 },
  { label: 'рот открыт', key: 'jawOpen', threshold: T.jawOpen, scale: 1 },
  { label: 'глаза закрыты', key: 'eyesClosed', threshold: T.eyesClosed, scale: 1 },
  { label: 'взгляд в сторону', key: 'gazeAside', threshold: T.eyesOnlyGaze, scale: 1 },
  { label: 'поворот, °', key: 'yaw', threshold: T.turnDeg, scale: 45 },
]

/** `?debug=1`: live features vs. thresholds, for tuning the gesture rules on a real face. */
export function DebugPanel() {
  const { features, mood, quality, allowed } = useEngineSnapshot()
  return (
    <aside className="debug-panel" aria-label="Отладка распознавания">
      <p className="debug-title">debug · {allowed.join(', ') || 'жесты выключены'}</p>
      {ROWS.map(({ label, key, threshold, scale }) => {
        const value = features ? features[key] : 0
        const ratio = Math.min(1, Math.abs(value) / scale)
        return (
          <div key={key} className={`debug-row ${Math.abs(value) >= threshold ? 'is-over' : ''}`}>
            <span>{label}</span>
            <span className="debug-bar">
              <span style={{ transform: `scaleX(${ratio})` }} />
              <i style={{ left: `${(threshold / scale) * 100}%` }} />
            </span>
            <span className="debug-value">{value.toFixed(key === 'yaw' ? 0 : 2)}</span>
          </div>
        )
      })}
      <p className="debug-mood">страх {mood.fear.toFixed(2)} · радость {mood.joy.toFixed(2)} · скука {mood.boredom.toFixed(2)}</p>
      {quality && <p className="debug-mood">кадр: {quality.id}</p>}
    </aside>
  )
}
