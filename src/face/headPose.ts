import type { HeadPose } from './types'

const RAD_TO_DEG = 180 / Math.PI

/**
 * MediaPipe returns a 4x4 face->camera transform as a flat array. Its layout is not documented,
 * so detect it: in column-major form the translation lives in [12..14] and [3], [7], [11] are 0.
 */
function isColumnMajor(data: readonly number[]): boolean {
  const bottomRow = Math.abs(data[3]) + Math.abs(data[7]) + Math.abs(data[11])
  const rightColumn = Math.abs(data[12]) + Math.abs(data[13]) + Math.abs(data[14])
  return rightColumn >= bottomRow
}

/** R = Rz(roll) * Ry(yaw) * Rx(pitch) decomposition of the rotation part. */
export function matrixToPose(data: readonly number[]): HeadPose {
  const columnMajor = isColumnMajor(data)
  const r = (row: number, col: number) => (columnMajor ? data[col * 4 + row] : data[row * 4 + col])

  const yaw = Math.atan2(-r(2, 0), Math.hypot(r(2, 1), r(2, 2)))
  const pitch = Math.atan2(r(2, 1), r(2, 2))
  const roll = Math.atan2(r(1, 0), r(0, 0))
  return { yaw: yaw * RAD_TO_DEG, pitch: pitch * RAD_TO_DEG, roll: roll * RAD_TO_DEG }
}
