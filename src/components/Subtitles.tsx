import { useEffect, useState, type RefObject } from 'react'
import type { MoodLabel } from '../mood/mood'
import { resolveLine, type SubtitleCue } from '../story/types'
import './subtitles.css'

interface SubtitlesProps {
  cues: readonly SubtitleCue[]
  timeRef: RefObject<number>
  /** resolved once per cue, when it appears, so a line does not flicker between mood variants */
  context: () => { mood: MoodLabel; visited: ReadonlySet<string> }
  /** changes reset the cue memory (new clip) */
  clipKey: string
}

export function Subtitles({ cues, timeRef, context, clipKey }: SubtitlesProps) {
  const [line, setLine] = useState<{ index: number; text: string } | null>(null)

  useEffect(() => {
    setLine(null)
    let frame = 0
    let shown = -1
    const tick = () => {
      const t = timeRef.current ?? 0
      const index = cues.findIndex((cue) => t >= cue.at && t < cue.until)
      if (index !== shown) {
        shown = index
        setLine(index === -1 ? null : { index, text: resolveLine(cues[index].text, context()) })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- context is read lazily on purpose
  }, [cues, timeRef, clipKey])

  return (
    <div className="subtitles" aria-live="polite">
      {line && <p key={`${clipKey}-${line.index}`}>{line.text}</p>}
    </div>
  )
}
