import type { CSSProperties } from 'react'
import { GestureOption } from '../components/GestureOption'
import { HintBar } from '../components/HintBar'
import { useEngineSnapshot } from '../engine/useFaceEngine'
import type { Choice } from '../story/types'
import './choiceOverlay.css'

interface ChoiceOverlayProps {
  choice: Choice
  prompt: string
}

/** Bottom band during a decision: the question, both gesture options with live meters, and the clock. */
export function ChoiceOverlay({ choice, prompt }: ChoiceOverlayProps) {
  const { meters } = useEngineSnapshot()
  const [left, right] = choice.options
  const turns = choice.options.filter((o) => o.gesture === 'turnLeft' || o.gesture === 'turnRight')
  return (
    <>
      {/* head-turn choices: the screen edge you turn towards lights up as you turn */}
      {turns.map((option) => {
        const meter = meters[option.gesture]
        const level = Math.max(meter?.progress ?? 0, meter?.hold ?? 0)
        const isLeft = option.gesture === 'turnLeft'
        return (
          <div key={option.gesture} className={`edge-cue ${isLeft ? 'is-left' : 'is-right'}`}
            style={{ '--level': level.toFixed(2) } as CSSProperties} aria-hidden="true">
            <span className="edge-arrow">{isLeft ? '‹' : '›'}</span>
            <span className="edge-label">{option.meaning}</span>
          </div>
        )
      })}
    <section className="choice-overlay" aria-label="Выбор">
      <p className="choice-prompt">{prompt}</p>
      <HintBar inline />
      <div className="choice-row">
        {left && <GestureOption gesture={left.gesture} title={left.meaning} meter={meters[left.gesture]} side="left" />}
        <span className="choice-or" aria-hidden="true">или</span>
        {right && <GestureOption gesture={right.gesture} title={right.meaning} meter={meters[right.gesture]} side="right" />}
      </div>
      <div className="choice-clock" aria-hidden="true">
        <span style={{ animationDuration: `${choice.timeoutMs}ms` }} />
      </div>
    </section>
    </>
  )
}
