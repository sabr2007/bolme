import type { Blendshapes, FaceFrame, HeadPose } from './types'

/**
 * Test-only camera replacement (`?mock=1`): emits face frames from scripted blendshapes at 30 fps, so the
 * whole journey — calibration, gestures, error hints, mood — can be driven by automation without a face.
 * Everything downstream (features, tracker, hints) is the real code.
 */
export interface MockFaceControl {
  /** raw MediaPipe blendshape scores (e.g. mouthSmileLeft) and/or head pose in degrees */
  set(patch: Readonly<Record<string, number>>): void
  neutral(): void
  hide(): void
  show(): void
}

declare global {
  interface Window {
    __mockFace?: MockFaceControl
  }
}

const FRAME_MS = 33
const POSE_KEYS = new Set(['yaw', 'pitch', 'roll'])
const NEUTRAL_POSE: HeadPose = { yaw: 0, pitch: 0, roll: 0 }
const FACE_BOX = { cx: 0.5, cy: 0.48, width: 0.34, height: 0.46 }

export function isMockCamera(): boolean {
  return new URLSearchParams(window.location.search).has('mock')
}

export class MockFaceSource {
  private blendshapes: Blendshapes = {}
  private pose: HeadPose = NEUTRAL_POSE
  private present = true
  private timer: number | null = null

  readonly control: MockFaceControl = {
    set: (patch) => {
      const entries = Object.entries(patch)
      this.blendshapes = { ...this.blendshapes, ...Object.fromEntries(entries.filter(([k]) => !POSE_KEYS.has(k))) }
      this.pose = { ...this.pose, ...Object.fromEntries(entries.filter(([k]) => POSE_KEYS.has(k))) }
    },
    neutral: () => {
      this.blendshapes = {}
      this.pose = NEUTRAL_POSE
    },
    hide: () => { this.present = false },
    show: () => { this.present = true },
  }

  start(onFrame: (frame: FaceFrame) => void): void {
    window.__mockFace = this.control
    this.timer = window.setInterval(() => {
      const t = performance.now()
      onFrame(this.present
        ? { t, present: true, blendshapes: this.blendshapes, pose: this.pose, box: FACE_BOX, landmarks: [] }
        : { t, present: false })
    }, FRAME_MS)
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    delete window.__mockFace
  }
}
