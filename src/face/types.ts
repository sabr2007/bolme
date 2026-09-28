export type Blendshapes = Readonly<Record<string, number>>

/** Degrees. yaw > 0: the viewer turned the head to THEIR left. pitch > 0: chin down. */
export type HeadPose = Readonly<{ yaw: number; pitch: number; roll: number }>

/** Normalized to the raw (non-mirrored) camera frame, 0..1. */
export type FaceBox = Readonly<{ cx: number; cy: number; width: number; height: number }>

export type Point3 = Readonly<{ x: number; y: number; z: number }>

export type FaceFrame =
  | Readonly<{
      t: number
      present: true
      blendshapes: Blendshapes
      pose: HeadPose
      box: FaceBox
      landmarks: readonly Point3[]
    }>
  | Readonly<{ t: number; present: false }>
