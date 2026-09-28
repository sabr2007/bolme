import { useEffect, useRef, useState } from 'react'
import { GestureIcon } from '../components/GestureIcon'
import type { GestureId } from '../gestures/types'
import { ClipPlayer } from '../player/ClipPlayer'
import './introScreen.css'

const BACKGROUND = `${import.meta.env.BASE_URL}media/intro-train.mp4`

interface Card {
  readonly id: string
  readonly durationMs: number
}

/** Hands-free intro: where you are, what controls the film, and what happens next. */
const CARDS: readonly Card[] = [
  { id: 'world', durationMs: 5000 },
  { id: 'you', durationMs: 5000 },
  { id: 'gestures', durationMs: 10000 },
  { id: 'ticket', durationMs: 6000 },
]

const GESTURE_GUIDE: ReadonlyArray<{ gesture: GestureId; action: string; meaning: string }> = [
  { gesture: 'turnLeft', action: 'Поворот головы', meaning: 'выбрать, куда идти' },
  { gesture: 'smile', action: 'Улыбка', meaning: 'довериться' },
  { gesture: 'frown', action: 'Нахмуриться', meaning: 'отказать' },
  { gesture: 'surprise', action: 'Удивление', meaning: 'окликнуть' },
  { gesture: 'eyesClosed', action: 'Закрыть глаза', meaning: 'спрятаться' },
]

interface IntroScreenProps {
  onDone: () => void
}

export function IntroScreen({ onDone }: IntroScreenProps) {
  const [index, setIndex] = useState(0)
  const timeRef = useRef(0)
  const card = CARDS[index]

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (index + 1 < CARDS.length) setIndex(index + 1)
      else onDone()
    }, card.durationMs)
    return () => window.clearTimeout(timer)
  }, [card, index, onDone])

  return (
    <main className="intro-screen" data-card={card.id}>
      <ClipPlayer src={BACKGROUND} playbackKey="intro" loop timeRef={timeRef} className="intro-bg" />
      <div className="intro-scrim" aria-hidden="true" />

      <section key={card.id} className={`intro-card card-${card.id}`} aria-live="polite">
        {card.id === 'world' && (
          <>
            <p className="intro-kicker">Ночной поезд</p>
            <h1 className="intro-title">Ночь. Бесконечная степь.<br />Поезд, которого нет ни в одном расписании.</h1>
          </>
        )}
        {card.id === 'you' && (
          <>
            <p className="intro-kicker">Кто ты</p>
            <h1 className="intro-title">Ты — его пассажир.<br />Этот фильм смотрит на тебя в ответ.</h1>
            <p className="intro-body">Здесь нет кнопок: сюжетом управляет твоё лицо. Камера видит мимику — в окне справа твоё отражение.</p>
          </>
        )}
        {card.id === 'gestures' && (
          <>
            <p className="intro-kicker">Пять жестов вместо кнопок</p>
            <ul className="intro-gestures">
              {GESTURE_GUIDE.map(({ gesture, action, meaning }) => (
                <li key={gesture}>
                  <GestureIcon gesture={gesture} size={56} />
                  <strong>{action}</strong>
                  <span>{meaning}</span>
                </li>
              ))}
            </ul>
            <p className="intro-body">Если жест получается не до конца, поезд подскажет, что поправить.</p>
          </>
        )}
        {card.id === 'ticket' && (
          <>
            <p className="intro-kicker">Сначала — проверка билета</p>
            <h1 className="intro-title">Проводница попросит повторить жесты.</h1>
            <p className="intro-body">Сядь прямо, лицо — в центре кадра и освещено. Дальше всё получится само.</p>
          </>
        )}
      </section>

      <footer className="intro-footer">
        <ol className="intro-progress" aria-label="Вступление">
          {CARDS.map((c, i) => (
            <li key={c.id} className={i < index ? 'is-done' : i === index ? 'is-current' : ''}>
              {i === index && <span style={{ animationDuration: `${c.durationMs}ms` }} />}
            </li>
          ))}
        </ol>
        <button className="intro-skip" onClick={onDone}>Пропустить</button>
      </footer>
    </main>
  )
}
