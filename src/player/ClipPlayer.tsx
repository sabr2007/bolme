import { useEffect, useRef, useState, type RefObject } from 'react'
import { resolveMedia } from './mediaCache'
import './clipPlayer.css'

interface ClipPlayerProps {
  /** null = black frame */
  src: string | null
  /** changes restart playback even when two scenes share the same clip */
  playbackKey: string
  loop?: boolean
  /** < 1 slows the clip down (subtitle cues are in clip time, so they stretch with it) */
  playbackRate?: number
  onEnded?: () => void
  /** receives the active clip's current time every animation frame (for subtitles) */
  timeRef?: RefObject<number>
  className?: string
}

/**
 * Double-buffered player: the next clip loads in the hidden <video> and is revealed only once it is
 * actually playing, so the previous frame stays on screen until then — no black flash between clips.
 */
export function ClipPlayer({ src, playbackKey, loop = false, playbackRate = 1, onEnded, timeRef, className }: ClipPlayerProps) {
  const videos = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)]
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded
  const srcRef = useRef(src)
  srcRef.current = src
  /** true while the next clip loads: its clock starts at 0, not at the previous clip's last second */
  const loadingRef = useRef(false)

  useEffect(() => {
    if (src === null) return
    let cancelled = false
    const target = 1 - activeRef.current
    const next = videos[target].current
    const previous = videos[activeRef.current].current
    if (!next) return

    loadingRef.current = true
    const reveal = () => {
      if (cancelled) return
      loadingRef.current = false
      activeRef.current = target
      setActive(target)
      previous?.pause()
    }
    resolveMedia(src).then((url) => {
      if (cancelled) return
      next.loop = loop
      next.src = url
      next.defaultPlaybackRate = playbackRate
      next.playbackRate = playbackRate
      next.currentTime = 0
      next.addEventListener('playing', reveal, { once: true })
      next.play().catch(() => {
        // autoplay can be refused before the first user gesture; muted retry keeps the film going
        next.muted = true
        void next.play()
      })
    })
    return () => {
      cancelled = true
      next.removeEventListener('playing', reveal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable; playbackKey restarts on purpose
  }, [src, playbackKey, loop, playbackRate])

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const video = videos[activeRef.current].current
      // a black clip (src null) is timed by its owner, so do not overwrite its clock
      if (timeRef && video && srcRef.current !== null) timeRef.current = loadingRef.current ? 0 : video.currentTime
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRef])

  const handleEnded = (index: number) => () => {
    if (index === activeRef.current) onEndedRef.current?.()
  }

  return (
    <div className={`clip-player ${src === null ? 'is-black' : ''} ${className ?? ''}`}>
      {videos.map((ref, index) => (
        <video
          key={index}
          ref={ref}
          className={index === active ? 'is-active' : ''}
          playsInline
          preload="auto"
          onEnded={handleEnded(index)}
        />
      ))}
    </div>
  )
}
