import { useCallback, useEffect, useState } from 'react'
import { useEngineSnapshot, useGestureEvents } from '../engine/useFaceEngine'
import type { GestureEvent } from '../gestures/tracker'
import './hintBar.css'

const HINT_VISIBLE_MS = 3200

interface HintBarProps {
  /** called for every coaching hint, e.g. to count them for the result screen */
  onHint?: (text: string) => void
  /** in the flow of a panel (right above the gesture it is about) instead of floating at the top */
  inline?: boolean
}

/**
 * The "error mode" surface: camera problems (persist while they last) outrank gesture coaching
 * hints (shown for a few seconds). Announced politely to screen readers.
 */
export function HintBar({ onHint, inline = false }: HintBarProps) {
  const { quality } = useEngineSnapshot()
  const [hint, setHint] = useState<{ text: string; key: number } | null>(null)

  const handleEvent = useCallback((event: GestureEvent) => {
    if (event.type !== 'hint') return
    setHint({ text: event.text, key: event.t })
    onHint?.(event.text)
  }, [onHint])
  useGestureEvents(handleEvent)

  useEffect(() => {
    if (!hint) return
    const timer = window.setTimeout(() => setHint(null), HINT_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [hint])

  const text = quality?.text ?? hint?.text ?? null
  return (
    <div className={`hint-bar ${inline ? 'is-inline' : ''}`} role="status" aria-live="polite">
      {text && (
        <p key={quality ? quality.id : hint?.key} className={`hint ${quality ? 'is-camera' : 'is-gesture'}`}>
          <span className="hint-mark" aria-hidden="true">{quality ? '◌' : '!'}</span>
          {text}
        </p>
      )}
    </div>
  )
}
