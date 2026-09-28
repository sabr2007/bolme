import { GestureOption } from '../components/GestureOption'
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
  return (
    <section className="choice-overlay" aria-label="Выбор">
      <p className="choice-prompt">{prompt}</p>
      <div className="choice-row">
        {left && <GestureOption gesture={left.gesture} meaning={left.meaning} meter={meters[left.gesture]} side="left" />}
        <span className="choice-or" aria-hidden="true">или</span>
        {right && <GestureOption gesture={right.gesture} meaning={right.meaning} meter={meters[right.gesture]} side="right" />}
      </div>
      <div className="choice-clock" aria-hidden="true">
        <span style={{ animationDuration: `${choice.timeoutMs}ms` }} />
      </div>
    </section>
  )
}
