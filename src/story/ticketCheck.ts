import type { GestureId } from '../gestures/types'

/** "Проверка билета": the in-world tutorial. The conductor asks for each gesture once. */
export interface TicketStep {
  readonly id: string
  readonly line: string
  readonly gesture: GestureId | 'calibrate'
}

export const TICKET_STEPS: readonly TicketStep[] = [
  { id: 'calibrate', line: 'Пассажир, проснитесь. Посмотрите на меня… Билет не нужен — я запомню ваше лицо.', gesture: 'calibrate' },
  { id: 'smile', line: 'Улыбнитесь. Мне нужно знать, что вы живой.', gesture: 'smile' },
  { id: 'frown', line: 'А теперь нахмурьтесь. Как контролёр.', gesture: 'frown' },
  { id: 'left', line: 'Посмотрите налево…', gesture: 'turnLeft' },
  { id: 'right', line: '…теперь направо.', gesture: 'turnRight' },
  { id: 'surprise', line: 'Удивитесь. Здесь это пригодится.', gesture: 'surprise' },
  { id: 'eyes', line: 'И закройте глаза. Досчитайте до двух.', gesture: 'eyesClosed' },
]

export const TICKET_ACCEPTED_LINE = 'Билет принят. Приятной поездки.'
export const STEP_TIMEOUT_LINE = 'Ладно. Поверю на слово.'
/** Nobody gets stuck: after this the conductor moves on by herself. */
export const STEP_TIMEOUT_MS = 20000
export const STEP_PRAISE_MS = 900
