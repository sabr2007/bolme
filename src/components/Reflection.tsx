import { FaceLandmarker } from '@mediapipe/tasks-vision'
import { useEffect, useRef, type RefObject } from 'react'
import { useEngine } from '../engine/useFaceEngine'
import type { GestureId } from '../gestures/types'
import './reflection.css'

type Region = 'oval' | 'lips' | 'brows' | 'eyes'

type Connection = (typeof FaceLandmarker.FACE_LANDMARKS_LIPS)[number]

const REGION_CONNECTIONS: Readonly<Record<Region, readonly Connection[]>> = {
  oval: FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
  lips: FaceLandmarker.FACE_LANDMARKS_LIPS,
  brows: [...FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW],
  eyes: [...FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE],
}

/** Which part of the face each gesture is read from: that part glows while the gesture is possible. */
const GESTURE_REGIONS: Readonly<Record<GestureId, readonly Region[]>> = {
  turnLeft: ['oval'],
  turnRight: ['oval'],
  smile: ['lips', 'eyes'],
  frown: ['brows'],
  surprise: ['brows', 'lips'],
  eyesClosed: ['eyes'],
}

const WIDTH = 240
const HEIGHT = 180

interface ReflectionProps {
  camera: RefObject<HTMLVideoElement | null>
}

/** The viewer's face as a reflection in the dark carriage window, with the landmarks the system reads. */
export function Reflection({ camera }: ReflectionProps) {
  const engine = useEngine()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = WIDTH * dpr
    canvas.height = HEIGHT * dpr
    ctx.scale(dpr, dpr)

    let frame = 0
    const draw = () => {
      frame = requestAnimationFrame(draw)
      const video = camera.current
      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      if (video && video.readyState >= 2) {
        ctx.save()
        ctx.translate(WIDTH, 0)
        ctx.scale(-1, 1)
        ctx.globalAlpha = 0.55
        ctx.drawImage(video, 0, 0, WIDTH, HEIGHT)
        ctx.restore()
      }
      const snapshot = engine.getSnapshot()
      const face = snapshot.frame
      // the mock camera (?mock=1) has no landmarks to draw
      if (!face?.present || face.landmarks.length < 468) return
      const lit = new Set(snapshot.allowed.flatMap((g) => GESTURE_REGIONS[g]))
      const warning = snapshot.quality !== null
      for (const region of Object.keys(REGION_CONNECTIONS) as Region[]) {
        const active = lit.has(region)
        ctx.strokeStyle = warning ? 'rgba(236, 120, 90, 0.8)' : active ? 'rgba(244, 190, 110, 0.95)' : 'rgba(170, 200, 235, 0.45)'
        ctx.lineWidth = active ? 1.6 : 1
        ctx.beginPath()
        for (const { start, end } of REGION_CONNECTIONS[region]) {
          const a = face.landmarks[start]
          const b = face.landmarks[end]
          ctx.moveTo((1 - a.x) * WIDTH, a.y * HEIGHT)
          ctx.lineTo((1 - b.x) * WIDTH, b.y * HEIGHT)
        }
        ctx.stroke()
      }
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [camera, engine])

  return (
    <figure className="reflection" aria-label="Ваше отражение в окне вагона: камера распознаёт лицо">
      <canvas ref={canvasRef} style={{ width: WIDTH, height: HEIGHT }} />
    </figure>
  )
}
