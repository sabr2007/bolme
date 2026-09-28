import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'
import type { GestureEvent } from '../gestures/tracker'
import type { FaceEngine, EngineSnapshot } from './faceEngine'

export const FaceEngineContext = createContext<FaceEngine | null>(null)

export function useEngine(): FaceEngine {
  const engine = useContext(FaceEngineContext)
  if (!engine) throw new Error('FaceEngineContext is missing')
  return engine
}

/** Re-renders only when the selected value changes (select must return a primitive or a stable reference). */
export function useEngineSelector<T>(select: (snapshot: EngineSnapshot) => T): T {
  const engine = useEngine()
  return useSyncExternalStore(engine.subscribe, () => select(engine.getSnapshot()))
}

/** Re-renders on every processed camera frame; keep consumers small. */
export function useEngineSnapshot(): EngineSnapshot {
  const engine = useEngine()
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot)
}

export function useGestureEvents(listener: (event: GestureEvent) => void): void {
  const engine = useEngine()
  useEffect(() => engine.onGesture(listener), [engine, listener])
}
