import { classifyCameraError, FaceTracker, type CameraError } from '../face/faceTracker'
import { isMockCamera, MockFaceSource } from '../face/mockFaceSource'
import type { FaceFrame } from '../face/types'
import { buildBaseline, CALIBRATION_MS } from '../features/calibration'
import { computeFeatures, NEUTRAL_BASELINE, type Baseline, type Features } from '../features/features'
import { checkQuality, type QualityIssue } from '../gestures/quality'
import { createTracker, stepTracker, type GestureEvent, type GestureMeter, type TrackerState } from '../gestures/tracker'
import type { GestureId } from '../gestures/types'
import { INITIAL_MOOD, stepMood, type Mood } from '../mood/mood'
import { measureBrightness } from './brightness'

const BRIGHTNESS_INTERVAL_MS = 500

export type EngineStatus = 'idle' | 'loading' | 'running' | 'error'

export interface EngineSnapshot {
  readonly status: EngineStatus
  readonly error: CameraError | null
  readonly frame: FaceFrame | null
  readonly features: Features | null
  readonly meters: Readonly<Partial<Record<GestureId, GestureMeter>>>
  /** gestures currently recognized and coached */
  readonly allowed: readonly GestureId[]
  readonly mood: Mood
  readonly quality: QualityIssue | null
  readonly calibrating: boolean
  /** 0..1 while calibrating */
  readonly calibrationProgress: number
}

const INITIAL_SNAPSHOT: EngineSnapshot = {
  status: 'idle',
  error: null,
  frame: null,
  features: null,
  meters: {},
  allowed: [],
  mood: INITIAL_MOOD,
  quality: null,
  calibrating: false,
  calibrationProgress: 0,
}

interface Calibration {
  readonly startedAt: number
  readonly frames: readonly FaceFrame[]
  readonly resolve: (ok: boolean) => void
}

/**
 * Imperative shell around the pure pieces (features, tracker, mood): owns the camera loop and
 * publishes an immutable snapshot per frame for React (useSyncExternalStore) plus gesture events.
 */
export class FaceEngine {
  private snapshot: EngineSnapshot = INITIAL_SNAPSHOT
  private readonly listeners = new Set<() => void>()
  private readonly gestureListeners = new Set<(event: GestureEvent) => void>()
  private readonly tracker = new FaceTracker()
  private readonly mock = isMockCamera() ? new MockFaceSource() : null
  private trackerState: TrackerState = createTracker([])
  private baseline: Baseline = NEUTRAL_BASELINE
  private calibration: Calibration | null = null
  private lastFaceAt = 0
  private brightness: number | null = null
  private brightnessTimer: number | null = null

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = (): EngineSnapshot => this.snapshot

  onGesture(listener: (event: GestureEvent) => void): () => void {
    this.gestureListeners.add(listener)
    return () => this.gestureListeners.delete(listener)
  }

  async start(video: HTMLVideoElement): Promise<boolean> {
    if (this.snapshot.status === 'running' || this.snapshot.status === 'loading') return true
    this.publish({ status: 'loading', error: null })
    try {
      if (this.mock) {
        this.mock.start((frame) => this.handleFrame(frame))
      } else {
        await this.tracker.start(video, (frame) => this.handleFrame(frame))
        this.brightnessTimer = window.setInterval(() => {
          const frame = this.snapshot.frame
          this.brightness = measureBrightness(video, frame?.present ? frame.box : null)
        }, BRIGHTNESS_INTERVAL_MS)
      }
      this.publish({ status: 'running' })
      return true
    } catch (error: unknown) {
      this.publish({ status: 'error', error: classifyCameraError(error) })
      return false
    }
  }

  stop(): void {
    this.tracker.stop()
    this.mock?.stop()
    if (this.brightnessTimer !== null) window.clearInterval(this.brightnessTimer)
    this.brightnessTimer = null
    this.publish({ status: 'idle' })
  }

  /** Only these gestures are recognized (and coached) until the next call. */
  setAllowed(gestures: readonly GestureId[]): void {
    this.trackerState = createTracker(gestures)
    this.publish({ meters: {}, allowed: gestures })
  }

  /** Collects CALIBRATION_MS of face frames; resolves false when the face was not visible enough. */
  calibrate(): Promise<boolean> {
    this.calibration?.resolve(false)
    return new Promise((resolve) => {
      this.calibration = { startedAt: performance.now(), frames: [], resolve }
      this.publish({ calibrating: true, calibrationProgress: 0 })
    })
  }

  private handleFrame(frame: FaceFrame): void {
    if (frame.present) this.lastFaceAt = frame.t
    const msWithoutFace = frame.present ? 0 : frame.t - this.lastFaceAt
    const quality = checkQuality(frame, msWithoutFace, this.brightness)

    // "too dark" is advice, not a blocker: if the landmarker still sees the face, gestures keep working
    const blocking = quality !== null && quality.id !== 'too-dark'

    if (this.calibration) {
      this.stepCalibration(this.calibration, frame, blocking ? quality : null, quality)
      return
    }

    const features = frame.present ? computeFeatures(frame.blendshapes, frame.pose, this.baseline) : null
    const mood = stepMood(this.snapshot.mood, features, frame.t)
    let meters = this.snapshot.meters
    if (features && !blocking) {
      const result = stepTracker(this.trackerState, features, frame.t)
      this.trackerState = result.state
      meters = result.meters
      result.events.forEach((event) => this.gestureListeners.forEach((listener) => listener(event)))
    }
    this.publish({ frame, features, mood, quality, meters })
  }

  private stepCalibration(
    calibration: Calibration, frame: FaceFrame, blocking: QualityIssue | null, quality: QualityIssue | null,
  ): void {
    const frames = blocking || !frame.present ? calibration.frames : [...calibration.frames, frame]
    const elapsed = frame.t - calibration.startedAt
    const progress = Math.min(1, frames.length / Math.max(1, (CALIBRATION_MS / 1000) * 24))
    if (progress < 1) {
      this.calibration = { ...calibration, frames }
      this.publish({ frame, quality, calibrationProgress: progress })
      return
    }
    const baseline = buildBaseline(frames)
    this.calibration = null
    if (baseline) this.baseline = baseline
    this.publish({ frame, quality, calibrating: false, calibrationProgress: 1 })
    calibration.resolve(baseline !== null && elapsed > 0)
  }

  private publish(patch: Partial<EngineSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }
}
