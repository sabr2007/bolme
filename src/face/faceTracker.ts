import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import { matrixToPose } from './headPose'
import type { FaceBox, FaceFrame, Point3 } from './types'

const WASM_BASE = `${import.meta.env.BASE_URL}mediapipe/wasm`
const MODEL_URL = `${import.meta.env.BASE_URL}mediapipe/face_landmarker.task`

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
}

export type CameraError = 'denied' | 'not-found' | 'unknown'

export function classifyCameraError(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found'
  return 'unknown'
}

async function createLandmarker(): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
  const options = {
    runningMode: 'VIDEO' as const,
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  }
  try {
    return await FaceLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    })
  } catch (gpuError) {
    console.warn('FaceLandmarker GPU delegate failed, falling back to CPU', gpuError)
    return FaceLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
    })
  }
}

function boxOf(landmarks: readonly Point3[]): FaceBox {
  let minX = 1, minY = 1, maxX = 0, maxY = 0
  for (const p of landmarks) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY }
}

export function toFaceFrame(result: FaceLandmarkerResult, t: number): FaceFrame {
  const landmarks = result.faceLandmarks[0]
  const categories = result.faceBlendshapes[0]?.categories
  const matrix = result.facialTransformationMatrixes[0]
  if (!landmarks || !categories || !matrix) return { t, present: false }

  const blendshapes = Object.fromEntries(categories.map((c) => [c.categoryName, c.score]))
  return { t, present: true, blendshapes, pose: matrixToPose(matrix.data), box: boxOf(landmarks), landmarks }
}

/** Owns the camera stream and the landmarker; emits one FaceFrame per decoded video frame. */
export class FaceTracker {
  private landmarker: FaceLandmarker | null = null
  private stream: MediaStream | null = null
  private running = false
  private lastVideoTime = -1

  async start(video: HTMLVideoElement, onFrame: (frame: FaceFrame) => void): Promise<void> {
    const [landmarker, stream] = await Promise.all([
      createLandmarker(),
      navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS),
    ])
    this.landmarker = landmarker
    this.stream = stream
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    await video.play()
    this.running = true
    this.loop(video, onFrame)
  }

  private loop(video: HTMLVideoElement, onFrame: (frame: FaceFrame) => void): void {
    const tick = () => {
      if (!this.running || !this.landmarker) return
      if (video.readyState >= 2 && video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = video.currentTime
        const t = performance.now()
        onFrame(toFaceFrame(this.landmarker.detectForVideo(video, t), t))
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  stop(): void {
    this.running = false
    this.stream?.getTracks().forEach((track) => track.stop())
    this.landmarker?.close()
    this.stream = null
    this.landmarker = null
  }
}
