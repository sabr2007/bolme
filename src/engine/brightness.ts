import type { FaceBox } from '../face/types'

const SAMPLE_W = 32
const SAMPLE_H = 24

let canvas: HTMLCanvasElement | null = null

/**
 * Mean luma (0..1) of the camera picture. With a face box it measures only the face: in a dark room
 * lit by the screen the background is black while the face is perfectly readable, and that is fine.
 */
export function measureBrightness(video: HTMLVideoElement, face: FaceBox | null = null): number | null {
  if (video.readyState < 2 || !video.videoWidth) return null
  canvas ??= Object.assign(document.createElement('canvas'), { width: SAMPLE_W, height: SAMPLE_H })
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const vw = video.videoWidth
  const vh = video.videoHeight
  const [sx, sy, sw, sh] = face
    ? [(face.cx - face.width / 2) * vw, (face.cy - face.height / 2) * vh, face.width * vw, face.height * vh]
    : [0, 0, vw, vh]
  ctx.drawImage(video, Math.max(0, sx), Math.max(0, sy), Math.max(1, sw), Math.max(1, sh), 0, 0, SAMPLE_W, SAMPLE_H)
  const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H)
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  return sum / (data.length / 4) / 255
}
