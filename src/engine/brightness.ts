const SAMPLE_W = 32
const SAMPLE_H = 24

let canvas: HTMLCanvasElement | null = null

/** Mean luma (0..1) of a tiny downscaled copy of the current camera frame. */
export function measureBrightness(video: HTMLVideoElement): number | null {
  if (video.readyState < 2) return null
  canvas ??= Object.assign(document.createElement('canvas'), { width: SAMPLE_W, height: SAMPLE_H })
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H)
  const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H)
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  return sum / (data.length / 4) / 255
}
