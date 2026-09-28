import type { GestureId } from '../gestures/types'

interface GestureIconProps {
  gesture: GestureId
  size?: number
}

/** Minimal line pictograms of a face performing each gesture. */
export function GestureIcon({ gesture, size = 40 }: GestureIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {gesture === 'turnLeft' || gesture === 'turnRight' ? (
        <g transform={gesture === 'turnRight' ? 'translate(40 0) scale(-1 1)' : undefined}>
          <path d="M22 8c6 0 10 5 10 12s-4 12-10 12c-5 0-8-4-8-7l-4-2 4-3c0-7 3-12 8-12z" />
          <path d="M8 13l-4 4 4 4" />
          <circle cx="19" cy="18" r="1.2" fill="currentColor" />
        </g>
      ) : (
        <>
          <circle cx="20" cy="20" r="15" />
          {gesture === 'smile' && (<><path d="M13 23c3 4 11 4 14 0" /><path d="M13 16q2-2 4 0M23 16q2-2 4 0" /></>)}
          {gesture === 'frown' && (<><path d="M12 13l6 3M28 13l-6 3" /><circle cx="15" cy="19" r="1.2" fill="currentColor" /><circle cx="25" cy="19" r="1.2" fill="currentColor" /><path d="M14 28c3-2 9-2 12 0" /></>)}
          {gesture === 'surprise' && (<><path d="M12 11q3-3 6 0M22 11q3-3 6 0" /><circle cx="15" cy="17" r="1.6" /><circle cx="25" cy="17" r="1.6" /><ellipse cx="20" cy="27" rx="3" ry="4" /></>)}
          {gesture === 'eyesClosed' && (<><path d="M12 18q3 3 6 0M22 18q3 3 6 0" /><path d="M16 27h8" /></>)}
        </>
      )}
    </svg>
  )
}
